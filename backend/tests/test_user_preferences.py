"""后端接口测试：用户主题偏好 API"""
import pytest
from backend.schemas import ThemePreferenceUpdate, ThemePreferenceOut, PRESET_COLORS
from backend.routers.user_preferences import _migrate_desktop_layout


def test_preset_colors_constant():
    """验证预设颜色常量"""
    assert "coral" in PRESET_COLORS
    assert "jade" in PRESET_COLORS
    assert "ocean" in PRESET_COLORS
    assert "violet" in PRESET_COLORS
    assert "amber" in PRESET_COLORS
    assert PRESET_COLORS["coral"] == "#E45B3F"


def test_theme_preference_update_valid_preset():
    """测试有效的预设主题偏好更新"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "coral",
        "primary_color": "#E45B3F",
        "desktop_layout": "desktop-default",
        "mobile_layout": "mobile-default",
    }
    model = ThemePreferenceUpdate(**payload)
    assert model.color_mode == "preset"
    assert model.preset_color_id == "coral"
    assert model.primary_color == "#E45B3F"


def test_theme_preference_update_valid_custom():
    """测试有效的自定义主题偏好更新"""
    payload = {
        "color_mode": "custom",
        "preset_color_id": None,
        "primary_color": "#FF5733",
        "desktop_layout": "desktop-sidebar-workbench",
        "mobile_layout": "mobile-compact",
    }
    model = ThemePreferenceUpdate(**payload)
    assert model.color_mode == "custom"
    assert model.preset_color_id is None
    assert model.primary_color == "#FF5733"
    assert model.desktop_layout == "desktop-sidebar-workbench"


def test_theme_preference_update_valid_sidebar_workbench():
    """测试有效的侧栏工作台布局"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "jade",
        "primary_color": "#3F8F70",
        "desktop_layout": "desktop-sidebar-workbench",
        "mobile_layout": "mobile-default",
    }
    model = ThemePreferenceUpdate(**payload)
    assert model.desktop_layout == "desktop-sidebar-workbench"


def test_theme_preference_update_reject_invalid_color():
    """拒绝非法颜色格式"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "coral",
        "primary_color": "invalid",
        "desktop_layout": "desktop-default",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_theme_preference_update_reject_unknown_preset():
    """拒绝未知预设"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "unknown",
        "primary_color": "#FF0000",
        "desktop_layout": "desktop-default",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_theme_preference_update_reject_unknown_layout():
    """拒绝未知布局"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "coral",
        "primary_color": "#E45B3F",
        "desktop_layout": "unknown-layout",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_theme_preference_update_reject_old_desktop_focus():
    """拒绝旧的 desktop-focus 布局 ID"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "coral",
        "primary_color": "#E45B3F",
        "desktop_layout": "desktop-focus",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_theme_preference_update_reject_preset_color_mismatch():
    """拒绝预设颜色与服务端映射不一致"""
    payload = {
        "color_mode": "preset",
        "preset_color_id": "coral",
        "primary_color": "#3F8F70",  # 应为 #E45B3F
        "desktop_layout": "desktop-default",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_theme_preference_update_reject_custom_with_preset_id():
    """拒绝 custom 模式携带 preset_color_id"""
    payload = {
        "color_mode": "custom",
        "preset_color_id": "coral",
        "primary_color": "#FF5733",
        "desktop_layout": "desktop-default",
        "mobile_layout": "mobile-default",
    }
    with pytest.raises(Exception):
        ThemePreferenceUpdate(**payload)


def test_all_preset_colors_valid():
    """验证所有预设颜色都能通过校验"""
    for preset_id, color in PRESET_COLORS.items():
        payload = {
            "color_mode": "preset",
            "preset_color_id": preset_id,
            "primary_color": color,
            "desktop_layout": "desktop-default",
            "mobile_layout": "mobile-default",
        }
        model = ThemePreferenceUpdate(**payload)
        assert model.primary_color == color


# ---- 旧值迁移测试 ----

def test_migrate_desktop_layout_valid_default():
    """合法值 desktop-default 保持不变"""
    assert _migrate_desktop_layout("desktop-default") == "desktop-default"


def test_migrate_desktop_layout_valid_sidebar_workbench():
    """合法值 desktop-sidebar-workbench 保持不变"""
    assert _migrate_desktop_layout("desktop-sidebar-workbench") == "desktop-sidebar-workbench"


def test_migrate_desktop_layout_old_focus():
    """旧值 desktop-focus 回退为 desktop-default"""
    assert _migrate_desktop_layout("desktop-focus") == "desktop-default"


def test_migrate_desktop_layout_unknown():
    """未知值回退为 desktop-default"""
    assert _migrate_desktop_layout("unknown-layout") == "desktop-default"
    assert _migrate_desktop_layout("") == "desktop-default"
