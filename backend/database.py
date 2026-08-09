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


async def _recalc_all_spent(session):
    """Recalculate spent for all budget categories across all projects on startup."""
    from sqlalchemy import select as _sel
    from .models import Expense, BudgetCategory

    result = await session.execute(
        _sel(Expense).where(Expense.status.in_(["paid", "prepaid"]))
    )
    expenses = result.scalars().all()
    totals: dict[str, float] = {}
    for e in expenses:
        totals[e.category_id] = totals.get(e.category_id, 0.0) + e.amount

    cat_result = await session.execute(_sel(BudgetCategory))
    for cat in cat_result.scalars():
        cat.spent = totals.get(cat.id, 0.0)

    await session.commit()


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

            # Recalculate spent for all budget categories on startup
            await _recalc_all_spent(session)
        finally:
            await session.close()
