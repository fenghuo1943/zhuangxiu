"""Seed example renovation tips for the first user (idempotent).

Assigns sample tips to the first admin user (or first user overall) so the
feature isn't an empty shell on first launch. Re-running skips if that user
already has any tips.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from .models import User, Tip

# (title, room, content, status)
EXAMPLE_TIPS = [
    ("衣柜挂衣杆朝里挪 3~4cm", "主卧",
     "挂衣杆离背板内移 3~4cm，衣服挂上后柜门更好关，尤其厚外套不容易卡门。来源：装修博主经验。",
     "pending"),
    ("厨房洗菜区和切菜区上方加灯带", "厨房",
     "吊柜底部加灯带，人站台面前不会挡住顶灯，切菜看得清更安全；水电阶段就要预留灯带线。",
     "pending"),
    ("玄关预留感应灯", "玄关",
     "入户预留感应灯插座，开门自动亮，回家不用摸黑。",
     "pending"),
    ("卫生间镜柜后留插座", "卫生间",
     "镜柜内预留插座给电动牙刷、吹风机充电，不用拉线到台面。",
     "pending"),
    ("沙发墙预留投影仪插座和网口", "客厅",
     "布水电时在沙发墙上方预留投影仪插座和网线口，后期装投影不用明线。",
     "pending"),
]


async def seed_tips(session: AsyncSession) -> None:
    # Skip entirely if there are no users yet
    user_count = await session.scalar(select(func.count(User.id)))
    if not user_count:
        return

    # Prefer the admin user, otherwise the first registered user
    result = await session.execute(
        select(User).where(User.is_admin == True).order_by(User.created_at)  # noqa: E712
    )
    user = result.scalars().first()
    if user is None:
        result = await session.execute(select(User).order_by(User.created_at))
        user = result.scalars().first()

    # Idempotent: only seed if this user has no tips yet
    tip_count = await session.scalar(select(func.count(Tip.id)).where(Tip.user_id == user.id))
    if tip_count:
        return

    for title, room, content, status in EXAMPLE_TIPS:
        session.add(Tip(
            id=f"tip_seed_{abs(hash((user.id, title))) % 10**9}",
            user_id=user.id,
            title=title,
            room=room,
            content=content,
            status=status,
            images=[],
        ))
    await session.commit()
