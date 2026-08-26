/**
 * 主题设置页面
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useTheme } from '../components/theme/ThemeProvider';
import { updateThemePreference } from '../api/userPreferences';
import {
  ThemePreference,
  DEFAULT_THEME_PREFERENCE,
  PRESET_COLORS,
  DESKTOP_LAYOUTS,
  MOBILE_LAYOUTS,
  isValidHexColor,
  normalizeHexColor,
  generateThemeColors,
  PresetColorId,
  ThemeColorMode,
} from '../data/theme';

const ThemeSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { preference: appliedPreference, applyTheme } = useTheme();

  // 草稿状态（仅在设置页本地管理）
  const [draft, setDraft] = useState<ThemePreference>(appliedPreference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当已应用配置变化时，更新草稿
  useEffect(() => {
    setDraft(appliedPreference);
  }, [appliedPreference]);

  // 预览颜色（仅用于预览，不影响全局）
  const previewColors = useMemo(() => generateThemeColors(draft.primaryColor), [draft.primaryColor]);

  // 检测屏幕宽度
  const isMobile = window.innerWidth < 768;

  // 处理预设色选择
  const handlePresetSelect = (presetId: PresetColorId, color: string) => {
    setDraft(prev => ({
      ...prev,
      colorMode: 'preset',
      presetColorId: presetId,
      primaryColor: color,
    }));
    setError(null);
  };

  // 处理自定义颜色选择
  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    const normalized = normalizeHexColor(color);
    if (normalized) {
      setDraft(prev => ({
        ...prev,
        colorMode: 'custom',
        presetColorId: null,
        primaryColor: normalized,
      }));
      setError(null);
    } else {
      setError('颜色值无效，请重新选择');
    }
  };

  // 处理桌面布局选择
  const handleDesktopLayoutChange = (layoutId: string) => {
    setDraft(prev => ({
      ...prev,
      desktopLayout: layoutId as any,
    }));
  };

  // 处理移动布局选择
  const handleMobileLayoutChange = (layoutId: string) => {
    setDraft(prev => ({
      ...prev,
      mobileLayout: layoutId as any,
    }));
  };

  // 取消
  const handleCancel = () => {
    setDraft(appliedPreference);
    navigate('/account');
  };

  // 恢复默认
  const handleReset = () => {
    setDraft(DEFAULT_THEME_PREFERENCE);
    setError(null);
  };

  // 确定并应用
  const handleApply = async () => {
    if (!isValidHexColor(draft.primaryColor)) {
      setError('颜色值格式不正确');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 调用 API 保存
      const savedPreference = await updateThemePreference({
        colorMode: draft.colorMode,
        presetColorId: draft.presetColorId,
        primaryColor: draft.primaryColor,
        desktopLayout: draft.desktopLayout,
        mobileLayout: draft.mobileLayout,
      });

      // 应用到全站
      applyTheme(savedPreference);

      // 提示成功
      alert('主题设置已保存');
    } catch (err: any) {
      console.error('Failed to save theme:', err);
      setError(err.message || '保存失败，请重试');
      // 失败时保留草稿，不应用
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell currentPage="theme-settings">
      <div className="placeholder-page">
        {/* 页面标题 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>🎨 主题与布局</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fresh-muted)' }}>
              设置将与当前账号关联，在其他设备登录后自动同步
            </p>
          </div>
        </div>

        {/* 主题色选择 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>主题色</h3>

            {/* 预设色选择区 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              {PRESET_COLORS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id, preset.color)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: draft.colorMode === 'preset' && draft.presetColorId === preset.id
                      ? `2px solid ${preset.color}`
                      : '2px solid var(--fresh-line)',
                    background: draft.colorMode === 'preset' && draft.presetColorId === preset.id
                      ? `${preset.color}10`
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: preset.color,
                      boxShadow: draft.colorMode === 'preset' && draft.presetColorId === preset.id
                        ? `0 0 0 3px ${preset.color}30`
                        : 'none',
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{preset.name}</span>
                </button>
              ))}
            </div>

            {/* 自定义调色盘 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--fresh-muted)' }}>自定义颜色：</span>
              <input
                type="color"
                value={draft.primaryColor}
                onChange={handleCustomColorChange}
                style={{
                  width: 48,
                  height: 36,
                  padding: 0,
                  border: '1px solid var(--fresh-line)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--fresh-subtle)', fontFamily: 'monospace' }}>
                {draft.primaryColor}
              </span>
            </div>

            {/* 错误提示 */}
            {error && (
              <div style={{ marginTop: 12, color: '#EF4444', fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* 小型预览 */}
            <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: 'var(--fresh-bg)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--fresh-muted)' }}>效果预览</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: previewColors.primary,
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  主要按钮
                </button>
                <span style={{ color: previewColors.primary, fontWeight: 600 }}>链接文字</span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: previewColors.primarySoft,
                    border: `2px solid ${previewColors.primary}`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 桌面端布局选择 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>桌面端布局</h3>
            {isMobile ? (
              <p style={{ color: 'var(--fresh-muted)', fontSize: 14 }}>
                请在桌面端预览和选择
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {DESKTOP_LAYOUTS.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => handleDesktopLayoutChange(layout.id)}
                    style={{
                      flex: '1 1 200px',
                      padding: 16,
                      borderRadius: 8,
                      border: draft.desktopLayout === layout.id
                        ? '2px solid var(--theme-primary)'
                        : '2px solid var(--fresh-line)',
                      background: draft.desktopLayout === layout.id
                        ? 'var(--theme-primary-soft)'
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{layout.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--fresh-muted)' }}>{layout.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 移动端布局选择 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>移动端布局</h3>
            {!isMobile ? (
              <p style={{ color: 'var(--fresh-muted)', fontSize: 14 }}>
                请在移动端预览和选择
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {MOBILE_LAYOUTS.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => handleMobileLayoutChange(layout.id)}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: draft.mobileLayout === layout.id
                        ? '2px solid var(--theme-primary)'
                        : '2px solid var(--fresh-line)',
                      background: draft.mobileLayout === layout.id
                        ? 'var(--theme-primary-soft)'
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{layout.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--fresh-muted)' }}>{layout.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '16px 24px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid var(--fresh-line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            className="btn btn-outline"
            onClick={handleCancel}
            disabled={saving}
          >
            取消
          </button>
          <button
            className="btn btn-outline"
            onClick={handleReset}
            disabled={saving}
          >
            恢复默认
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={saving}
          >
            {saving ? '保存中...' : '确定并应用'}
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default ThemeSettingsPage;
