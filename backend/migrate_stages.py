"""Migration script to update purchase reference stages."""

import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+aiomysql://renovation:Wzcx131130_@192.168.31.146:3307/renovation")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def migrate_stages():
    """Migrate stage data to new structure."""
    async with async_session() as session:
        try:
            # Disable foreign key checks for this migration
            await session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

            # Step 1: Check current state
            result = await session.execute(
                text("SELECT id, parent FROM purchase_ref_stages ORDER BY id")
            )
            stages = result.fetchall()
            print("Current stages:")
            for stage in stages:
                print(f"  {stage[0]}: {stage[1]}")

            # Step 2: Move subgroups from 开工前准备 (stage_0) to 水电阶段 (stage_1)
            print("\nStep 1: Moving subgroups from 开工前准备 to 水电阶段...")
            await session.execute(
                text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_1' WHERE stage_id = 'stage_0'")
            )
            print("  Done")

            # Step 3: Delete 开工前准备 (stage_0)
            print("\nStep 2: Deleting 开工前准备...")
            await session.execute(
                text("DELETE FROM purchase_ref_stages WHERE id = 'stage_0'")
            )
            print("  Done")

            # Step 4: Rename 水电阶段 from stage_1 to stage_0
            print("\nStep 3: Renaming 水电阶段 to stage_0...")
            await session.execute(
                text("UPDATE purchase_ref_stages SET id = 'stage_0' WHERE id = 'stage_1'")
            )
            await session.execute(
                text("UPDATE purchase_ref_subgroups SET stage_id = 'stage_0' WHERE stage_id = 'stage_1'")
            )
            print("  Done")

            # Step 5: Create 拆改阶段 as stage_1
            print("\nStep 4: Creating 拆改阶段...")
            await session.execute(
                text("INSERT INTO purchase_ref_stages (id, parent) VALUES ('stage_1', '拆改阶段')")
            )
            # Create subgroups with new IDs to avoid conflicts
            subgroups = [
                ("sub_7_0", "拆除工具"),
                ("sub_7_1", "保护材料"),
                ("sub_7_2", "新建墙体"),
                ("sub_7_3", "门窗改造"),
            ]
            for sub_id, sub_name in subgroups:
                await session.execute(
                    text("INSERT INTO purchase_ref_subgroups (id, stage_id, name) VALUES (:id, 'stage_1', :name)"),
                    {"id": sub_id, "name": sub_name}
                )
            print("  Created 拆改阶段 with 4 subgroups")

            # Re-enable foreign key checks
            await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

            await session.commit()
            print("\nMigration completed successfully!")

            # Verify final state
            result = await session.execute(
                text("SELECT id, parent FROM purchase_ref_stages ORDER BY id")
            )
            stages = result.fetchall()
            print("\nFinal stages:")
            for stage in stages:
                print(f"  {stage[0]}: {stage[1]}")

        except Exception as e:
            await session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await session.rollback()
            print(f"Migration failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(migrate_stages())
