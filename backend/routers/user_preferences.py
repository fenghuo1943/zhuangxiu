from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import UserPreference
from ..schemas import ThemePreferenceUpdate, ThemePreferenceOut, PRESET_COLORS, VALID_DESKTOP_LAYOUTS
from ..auth import get_current_user

router = APIRouter(prefix="/api/user-preferences", tags=["User Preferences"])

# 默认主题偏好
DEFAULT_THEME_PREFERENCE = {
    "color_mode": "preset",
    "preset_color_id": "coral",
    "primary_color": "#E45B3F",
    "desktop_layout": "desktop-default",
    "mobile_layout": "mobile-default",
    "updated_at": datetime.now(timezone.utc),
}


def _migrate_desktop_layout(layout: str) -> str:
    """将旧布局 ID 迁移到合法值，未知值回退为 desktop-default"""
    if layout in VALID_DESKTOP_LAYOUTS:
        return layout
    # 旧值兼容：desktop-focus 回退为 desktop-default
    return "desktop-default"


@router.get("/theme", response_model=ThemePreferenceOut)
async def get_theme_preference(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户主题偏好，无记录时返回默认值"""
    preference = await db.get(UserPreference, user.id)
    if preference is None:
        return ThemePreferenceOut(**DEFAULT_THEME_PREFERENCE)
    # 旧值迁移：将不合法的 desktop_layout 规范化
    preference.desktop_layout = _migrate_desktop_layout(preference.desktop_layout)
    return preference


@router.put("/theme", response_model=ThemePreferenceOut)
async def update_theme_preference(
    data: ThemePreferenceUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """原子创建或完整更新当前用户配置"""
    preference = await db.get(UserPreference, user.id)
    if preference is None:
        preference = UserPreference(user_id=user.id, **data.model_dump())
        db.add(preference)
    else:
        for field, value in data.model_dump().items():
            setattr(preference, field, value)
    await db.commit()
    await db.refresh(preference)
    return preference
