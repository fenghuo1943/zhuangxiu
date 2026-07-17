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
