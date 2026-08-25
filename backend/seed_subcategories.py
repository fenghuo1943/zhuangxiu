"""Seed the expense_sub_categories table with default subcategories.

These are the same subcategories defined in frontend/src/data/mockData.ts DEFAULT_SUB_CATEGORIES.
Default subcategories have project_id=NULL and is_default=True, visible to all projects.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import ExpenseSubCategory


# Default subcategories from mockData.ts
DEFAULT_SUBCATEGORIES = [
    # 硬装工程
    {"id": "hetong", "name": "合同款项", "category_id": "hard"},
    {"id": "chaigai", "name": "拆改", "category_id": "hard"},
    {"id": "qiangti", "name": "墙体砌筑", "category_id": "hard"},
    {"id": "baohu", "name": "成品保护", "category_id": "hard"},
    {"id": "shuidian", "name": "水电", "category_id": "hard"},
    {"id": "wagong", "name": "瓦工", "category_id": "hard"},
    {"id": "fangshui", "name": "防水", "category_id": "hard"},
    {"id": "baoguan", "name": "包管隔音", "category_id": "hard"},
    {"id": "mugong", "name": "木工", "category_id": "hard"},
    {"id": "youqi", "name": "油漆", "category_id": "hard"},
    {"id": "meifeng", "name": "美缝", "category_id": "hard"},
    # 主材选购
    {"id": "cizhuan", "name": "瓷砖", "category_id": "material"},
    {"id": "diban", "name": "地板", "category_id": "material"},
    {"id": "shicai", "name": "石材", "category_id": "material"},
    {"id": "menchuang", "name": "门窗", "category_id": "material"},
    {"id": "fengchuang", "name": "封窗", "category_id": "material"},
    {"id": "xingcaimen", "name": "型材门", "category_id": "material"},
    {"id": "chugui", "name": "橱柜", "category_id": "material"},
    {"id": "quanwudingzhi", "name": "全屋定制", "category_id": "material"},
    {"id": "weiyu", "name": "卫浴", "category_id": "material"},
    {"id": "jichengdiaoding", "name": "集成吊顶", "category_id": "material"},
    # 设备系统
    {"id": "dinuan", "name": "地暖", "category_id": "equipment"},
    {"id": "xinfeng", "name": "新风", "category_id": "equipment"},
    {"id": "jingshui", "name": "净水", "category_id": "equipment"},
    {"id": "kongtiao", "name": "空调", "category_id": "equipment"},
    {"id": "ranqi", "name": "燃气改造", "category_id": "equipment"},
    {"id": "zhineng", "name": "智能家居", "category_id": "equipment"},
    # 软装家电
    {"id": "jiaju", "name": "家具", "category_id": "soft"},
    {"id": "jiadian", "name": "家电", "category_id": "soft"},
    {"id": "ruanzhuang", "name": "软装", "category_id": "soft"},
    {"id": "dengju", "name": "灯具", "category_id": "soft"},
    {"id": "chuanglian", "name": "窗帘", "category_id": "soft"},
    # 服务杂项
    {"id": "wujin", "name": "五金", "category_id": "service"},
    {"id": "fucai", "name": "辅材杂料", "category_id": "service"},
    {"id": "yunshu", "name": "运输上楼", "category_id": "service"},
    {"id": "fuwufei", "name": "服务费", "category_id": "service"},
    {"id": "kaihuang", "name": "开荒保洁", "category_id": "service"},
    {"id": "other", "name": "其他", "category_id": "service"},
]


async def seed_subcategories(db: AsyncSession):
    """Seed default subcategories if not already present."""
    # Check if default subcategories already exist
    result = await db.execute(
        select(ExpenseSubCategory).where(ExpenseSubCategory.project_id.is_(None))
    )
    existing = result.scalars().all()
    existing_ids = {s.id for s in existing}

    # Add missing default subcategories
    added = 0
    for sub_data in DEFAULT_SUBCATEGORIES:
        if sub_data["id"] not in existing_ids:
            sub = ExpenseSubCategory(
                id=sub_data["id"],
                project_id=None,  # 默认分类，所有项目可见
                name=sub_data["name"],
                category_id=sub_data["category_id"],
                is_default=True,
            )
            db.add(sub)
            added += 1

    if added > 0:
        await db.commit()
        print(f"Seeded {added} default subcategories")
    else:
        print("Default subcategories already exist")
