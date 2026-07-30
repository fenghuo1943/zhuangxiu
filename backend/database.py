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
    """Add purchase-integration columns to existing tables and link old data."""
    import sqlite3

    # --- v1 migrations (keep for backward compat) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE price_categories ADD COLUMN purchase_item_id VARCHAR(36) REFERENCES purchase_ref_items(id)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE price_categories ADD COLUMN best_quote_id VARCHAR(36) REFERENCES channel_quotes(id)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    await conn.run_sync(
        lambda c: c.exec_driver_sql(
            "UPDATE price_categories SET purchase_item_id = ("
            "  SELECT id FROM purchase_ref_items"
            "  WHERE LOWER(purchase_ref_items.name) = LOWER(price_categories.name)"
            "  LIMIT 1"
            ") WHERE purchase_item_id IS NULL"
        )
    )

    # --- v2 migrations: deep integration ---
    # Add needs_compare to purchase_ref_items
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items ADD COLUMN needs_compare BOOLEAN DEFAULT 0"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Add item_id and project_id to price_models
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE price_models ADD COLUMN item_id VARCHAR(36) REFERENCES purchase_ref_items(id)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE price_models ADD COLUMN project_id VARCHAR(36) REFERENCES projects(id)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Migrate data: copy purchase_item_id and project_id from price_categories to price_models
    await conn.run_sync(
        lambda c: c.exec_driver_sql(
            "UPDATE price_models SET "
            "  item_id = (SELECT pc.purchase_item_id FROM price_categories pc WHERE pc.id = price_models.category_id), "
            "  project_id = (SELECT pc.project_id FROM price_categories pc WHERE pc.id = price_models.category_id) "
            "WHERE price_models.item_id IS NULL AND price_models.category_id IS NOT NULL"
        )
    )

    # Set needs_compare on purchase items that have a linked price model
    await conn.run_sync(
        lambda c: c.exec_driver_sql(
            "UPDATE purchase_ref_items SET needs_compare = 1 "
            "WHERE id IN (SELECT DISTINCT pm.item_id FROM price_models pm WHERE pm.item_id IS NOT NULL)"
        )
    )

    # Also set needs_compare for items that had linked PriceCategory (even without models)
    await conn.run_sync(
        lambda c: c.exec_driver_sql(
            "UPDATE purchase_ref_items SET needs_compare = 1 "
            "WHERE id IN (SELECT DISTINCT pc.purchase_item_id FROM price_categories pc WHERE pc.purchase_item_id IS NOT NULL)"
        )
    )

    # --- v3 migrations: project-scoped purchase items & compare items ---

    # Add project_id to purchase_ref_items (NULL = public/seed, non-NULL = project-private item)
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items ADD COLUMN project_id VARCHAR(36) REFERENCES projects(id)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Create project_compare_items if it doesn't exist (also handled by create_all)
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS project_compare_items ("
                "  id VARCHAR(36) PRIMARY KEY,"
                "  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),"
                "  item_id VARCHAR(36) NOT NULL REFERENCES purchase_ref_items(id)"
                ")"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v5: add price to purchase_ref_items and expense_id to purchased_items ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items ADD COLUMN price FLOAT"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchased_items ADD COLUMN expense_id VARCHAR(36)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v6: add expense_id to selected_purchases (for 待购 items with price) ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE selected_purchases ADD COLUMN expense_id VARCHAR(36)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # --- v4: add budget category/subcategory to purchase items ---
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items ADD COLUMN category_id VARCHAR(50)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass
    try:
        await conn.run_sync(
            lambda c: c.exec_driver_sql(
                "ALTER TABLE purchase_ref_items ADD COLUMN sub_category_id VARCHAR(50)"
            )
        )
    except (sqlite3.OperationalError, Exception):
        pass

    # Migrate: for items with needs_compare=True, create ProjectCompareItem entries
    # for each project that has selected or purchased those items.
    # Done in Python for database-agnostic compatibility.
    try:
        await _migrate_compare_items(conn)
    except Exception:
        pass  # best-effort data migration; don't block startup


async def _migrate_compare_items(conn):
    """Migrate existing needs_compare data to project_compare_items using Python logic."""
    import uuid as _uuid
    from sqlalchemy import text as _text

    # Find items with needs_compare=True
    result = await conn.run_sync(
        lambda c: c.execute(
            _text("SELECT id FROM purchase_ref_items WHERE needs_compare = 1")
        )
    )
    compare_item_ids = {row[0] for row in result.fetchall()}
    if not compare_item_ids:
        return

    # Find projects that selected or purchased those items
    projects_with_items: dict[str, set[str]] = {}  # project_id -> {item_id, ...}

    for table in ["selected_purchases", "purchased_items"]:
        result = await conn.run_sync(
            lambda c, t=table: c.execute(
                _text(f"SELECT DISTINCT project_id, item_id FROM {t}")
            )
        )
        for row in result.fetchall():
            project_id, item_id = row[0], row[1]
            if item_id in compare_item_ids:
                projects_with_items.setdefault(project_id, set()).add(item_id)

    # Also check price_models for project-scoped compare data
    result = await conn.run_sync(
        lambda c: c.execute(
            _text("SELECT DISTINCT project_id, item_id FROM price_models WHERE item_id IS NOT NULL AND project_id IS NOT NULL")
        )
    )
    for row in result.fetchall():
        project_id, item_id = row[0], row[1]
        if item_id in compare_item_ids:
            projects_with_items.setdefault(project_id, set()).add(item_id)

    # Check existing entries to avoid duplicates
    result = await conn.run_sync(
        lambda c: c.execute(
            _text("SELECT DISTINCT project_id, item_id FROM project_compare_items")
        )
    )
    existing_pairs = {(row[0], row[1]) for row in result.fetchall()}

    # Insert new entries
    for project_id, item_ids in projects_with_items.items():
        for item_id in item_ids:
            if (project_id, item_id) in existing_pairs:
                continue
            new_id = f"pci_{_uuid.uuid4().hex[:12]}"
            try:
                await conn.run_sync(
                    lambda c, nid=new_id, pid=project_id, iid=item_id: c.execute(
                        _text("INSERT INTO project_compare_items (id, project_id, item_id) VALUES (:id, :pid, :iid)"),
                        {"id": nid, "pid": pid, "iid": iid},
                    )
                )
            except Exception:
                pass  # duplicate or FK violation, skip


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate_integration(conn)

    # Seed purchase reference data (idempotent — skips if already populated)
    from .seed_purchase import seed_purchase_references
    from .seed_flow import seed_flow_stages
    async with async_session() as session:
        try:
            await seed_purchase_references(session)
            await seed_flow_stages(session)
        finally:
            await session.close()
