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


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed purchase reference data (idempotent — skips if already populated)
    from .seed_purchase import seed_purchase_references
    from .seed_flow import seed_flow_stages
    async with async_session() as session:
        try:
            await seed_purchase_references(session)
            await seed_flow_stages(session)
        finally:
            await session.close()
