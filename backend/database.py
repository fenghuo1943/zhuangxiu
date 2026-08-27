from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def _migrate_integration(conn):
    """Apply schema migrations for new columns (idempotent — skips if already present)."""
    import sqlite3

    # --- v8: synced flag on price_models (replaces synced_models table) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE price_models ADD COLUMN synced BOOLEAN DEFAULT 0"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Migrate existing synced_models data into price_models.synced
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "UPDATE price_models SET synced = 1 "
                "WHERE id IN (SELECT model_id FROM synced_models)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v9: price columns on selected_purchases & purchased_items (project-scoped prices) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE selected_purchases ADD COLUMN price FLOAT"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchased_items ADD COLUMN price FLOAT"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Migrate existing prices from purchase_ref_items to selected/purchased tables
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "UPDATE selected_purchases SET price = ("
                "  SELECT pri.price FROM purchase_ref_items pri"
                "  WHERE pri.id = selected_purchases.item_id"
                ") WHERE price IS NULL"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "UPDATE purchased_items SET price = ("
                "  SELECT pri.price FROM purchase_ref_items pri"
                "  WHERE pri.id = purchased_items.item_id"
                ") WHERE price IS NULL"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v10: drop deprecated columns and tables ---
    # Drop price_categories table (fully deprecated)
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql("DROP TABLE IF EXISTS price_categories")
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Drop synced_models table (replaced by price_models.synced)
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql("DROP TABLE IF EXISTS synced_models")
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Drop deprecated columns from purchase_ref_items
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items DROP COLUMN price"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items DROP COLUMN needs_compare"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v11: create user_preferences table (idempotent) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS user_preferences ("
                "user_id VARCHAR(36) PRIMARY KEY, "
                "color_mode VARCHAR(20) NOT NULL DEFAULT 'preset', "
                "preset_color_id VARCHAR(30), "
                "primary_color VARCHAR(7) NOT NULL DEFAULT '#E45B3F', "
                "desktop_layout VARCHAR(40) NOT NULL DEFAULT 'desktop-default', "
                "mobile_layout VARCHAR(40) NOT NULL DEFAULT 'mobile-default', "
                "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE"
                ")"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v12: add unpaid_spent column to budget_categories (idempotent) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE budget_categories ADD COLUMN unpaid_spent FLOAT DEFAULT 0"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v13: create renovation_diaries table (idempotent) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS renovation_diaries ("
                "id VARCHAR(36) PRIMARY KEY, "
                "project_id VARCHAR(36) NOT NULL, "
                "title VARCHAR(200) NOT NULL, "
                "date DATE NOT NULL, "
                "stage_parent VARCHAR(100) NOT NULL, "
                "content TEXT NOT NULL DEFAULT '', "
                "images JSON, "
                "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE"
                ")"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass


async def _recalc_all_spent(session):
    """Recalculate spent and unpaid_spent for all budget categories across all projects on startup."""
    from sqlalchemy import select as _sel
    from .models import Expense, BudgetCategory

    result = await session.execute(_sel(Expense))
    expenses = result.scalars().all()

    paid_totals: dict[str, float] = {}
    unpaid_totals: dict[str, float] = {}
    for e in expenses:
        category_key = e.category_id.rsplit("_", 1)[-1]
        if e.status in ("paid", "prepaid"):
            paid_totals[category_key] = paid_totals.get(category_key, 0.0) + e.amount
        elif e.status == "unpaid":
            unpaid_totals[category_key] = unpaid_totals.get(category_key, 0.0) + e.amount

    cat_result = await session.execute(_sel(BudgetCategory))
    for cat in cat_result.scalars():
        category_key = cat.id.rsplit("_", 1)[-1]
        cat.spent = paid_totals.get(category_key, 0.0)
        cat.unpaid_spent = unpaid_totals.get(category_key, 0.0)

    await session.commit()


async def _fix_budget_categories(session):
    """Fix budget categories with wrong names or colors (English names, same colors)."""
    from sqlalchemy import select as _sel, update as _upd
    from .models import BudgetCategory

    # Default names and colors for categories
    CATEGORY_DEFAULTS = {
        'hard': ('硬装工程', '#e45b3f'),
        'material': ('主材选购', '#5f9f77'),
        'equipment': ('设备系统', '#5c7fa8'),
        'soft': ('软装家电', '#be7b2f'),
        'service': ('服务杂项', '#9b928b'),
    }

    result = await session.execute(_sel(BudgetCategory))
    categories = result.scalars().all()

    updated = 0
    for cat in categories:
        # Extract the frontend category key from the DB ID (e.g. "p1_<hash>_hard" -> "hard")
        parts = cat.id.rsplit("_", 1)
        if len(parts) < 2:
            continue
        cat_key = parts[-1]

        if cat_key in CATEGORY_DEFAULTS:
            default_name, default_color = CATEGORY_DEFAULTS[cat_key]
            needs_update = False

            # Fix English names
            if cat.name == cat_key or cat.name in ['service', 'soft']:
                cat.name = default_name
                needs_update = True

            # Fix same/missing colors (if color is #999 or same as another category)
            if cat.color == '#999' or cat.color == '#666':
                cat.color = default_color
                needs_update = True

            if needs_update:
                updated += 1

    if updated > 0:
        await session.commit()
        print(f"Fixed {updated} budget categories with wrong names/colors")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate_integration(conn)

    # Seed purchase reference data (idempotent — skips if already populated)
    from .seed_purchase import seed_purchase_references
    from .seed_flow import seed_flow_stages
    from .seed_tips import seed_tips
    from sqlalchemy import select, update

    async with async_session() as session:
        try:
            await seed_purchase_references(session)
            await seed_flow_stages(session)
            await seed_tips(session)

            # Fix existing budget categories with wrong names or colors
            await _fix_budget_categories(session)

            # Recalculate spent for all budget categories on startup
            await _recalc_all_spent(session)
        finally:
            await session.close()
