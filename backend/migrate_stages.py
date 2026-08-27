"""Migration script to fix purchase reference stages order."""

import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+aiomysql://renovation:Wzcx131130_@192.168.31.146:3307/renovation")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def fix_stages():
    """Fix stage order: 准备->拆改->水电->瓦工->木工->油漆->安装->软装"""
    async with async_session() as session:
        try:
            await session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

            # Step 1: Move ALL stages to temporary IDs (from high to low to avoid conflicts)
            print("Step 1: Moving all stages to temporary IDs...")
            for i in range(6, -1, -1):
                old_id = f"stage_{i}"
                new_id = f"stage_temp_{i}"
                await session.execute(text(f"UPDATE purchase_ref_stages SET id = '{new_id}' WHERE id = '{old_id}'"))
                await session.execute(text(f"UPDATE purchase_ref_subgroups SET stage_id = '{new_id}' WHERE stage_id = '{old_id}'"))

            # Step 2: Assign new IDs in correct order
            print("Step 2: Assigning new IDs...")

            # stage_0: 准备阶段 (create new)
            await session.execute(text("INSERT INTO purchase_ref_stages (id, parent) VALUES ('stage_0', '准备阶段')"))

            # stage_1: 拆改阶段 (from stage_temp_1)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_1' WHERE id = 'stage_temp_1'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_1' WHERE stage_id = 'stage_temp_1'"))

            # stage_2: 水电阶段 (from stage_temp_0)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_2' WHERE id = 'stage_temp_0'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_2' WHERE stage_id = 'stage_temp_0'"))

            # stage_3: 瓦工阶段 (from stage_temp_2)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_3' WHERE id = 'stage_temp_2'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_3' WHERE stage_id = 'stage_temp_2'"))

            # stage_4: 木工阶段 (from stage_temp_3)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_4' WHERE id = 'stage_temp_3'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_4' WHERE stage_id = 'stage_temp_3'"))

            # stage_5: 油漆阶段 (from stage_temp_4)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_5' WHERE id = 'stage_temp_4'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_5' WHERE stage_id = 'stage_temp_4'"))

            # stage_6: 安装阶段 (from stage_temp_5)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_6' WHERE id = 'stage_temp_5'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_6' WHERE stage_id = 'stage_temp_5'"))

            # stage_7: 软装阶段 (from stage_temp_6)
            await session.execute(text("UPDATE purchase_ref_stages SET id = 'stage_7' WHERE id = 'stage_temp_6'"))
            await session.execute(text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_7' WHERE stage_id = 'stage_temp_6'"))

            await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await session.commit()
            print("Migration completed successfully!")

            # Verify
            print("\n=== Final State ===")
            result = await session.execute(text("SELECT id, parent FROM purchase_ref_stages ORDER BY id"))
            for row in result.fetchall():
                print(f"  {row[0]}: {row[1]}")

        except Exception as e:
            await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await session.rollback()
            print(f"Migration failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(fix_stages())
