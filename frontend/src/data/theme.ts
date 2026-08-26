/**
 * 主题领域类型与常量
 */

// ---- 类型定义 ----
export type ThemeColorMode = 'preset' | 'custom';
export type DesktopLayoutId = 'desktop-default' | 'desktop-sidebar-workbench';
export type MobileLayoutId = 'mobile-default' | 'mobile-compact';
export type PresetColorId = 'coral' | 'jade' | 'ocean' | 'violet' | 'amber';

export interface ThemePreference {
  colorMode: ThemeColorMode;
  presetColorId: PresetColorId | null;
  primaryColor: string;
  desktopLayout: DesktopLayoutId;
  mobileLayout: MobileLayoutId;
  updatedAt: string;
}

// ---- 预设颜色元数据 ----
export interface PresetColorMeta {
  id: PresetColorId;
  name: string;
  color: string;
}

export const PRESET_COLORS: PresetColorMeta[] = [
  { id: 'coral', name: '珊瑚橙', color: '#E45B3F' },
  { id: 'jade', name: '玉石绿', color: '#3F8F70' },
  { id: 'ocean', name: '海湾蓝', color: '#3B82C4' },
  { id: 'violet', name: '暮光紫', color: '#7C5CC4' },
  { id: 'amber', name: '琥珀金', color: '#C98525' },
];

export const PRESET_COLOR_MAP: Record<PresetColorId, string> = {
  coral: '#E45B3F',
  jade: '#3F8F70',
  ocean: '#3B82C4',
  violet: '#7C5CC4',
  amber: '#C98525',
};

// ---- 默认主题 ----
export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  colorMode: 'preset',
  presetColorId: 'coral',
  primaryColor: '#E45B3F',
  desktopLayout: 'desktop-default',
  mobileLayout: 'mobile-default',
  updatedAt: new Date().toISOString(),
};

// ---- 布局元数据 ----
export interface LayoutMeta {
  id: DesktopLayoutId | MobileLayoutId;
  name: string;
  description: string;
}

export const DESKTOP_LAYOUTS: LayoutMeta[] = [
  { id: 'desktop-default', name: '全景总览', description: '保持当前布局' },
  { id: 'desktop-sidebar-workbench', name: '侧栏工作台', description: '左侧导航、顶部页头与页面工作区，适合持续管理装修项目' },
];

export const MOBILE_LAYOUTS: LayoutMeta[] = [
  { id: 'mobile-default', name: '卡片总览', description: '保持当前布局' },
  { id: 'mobile-compact', name: '紧凑清单', description: '待办、待购等信息前置' },
];

// ---- 颜色校验与规范化 ----
/**
 * 校验颜色是否为合法的 #RRGGBB 格式
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * 将颜色规范化为大写 #RRGGBB 格式
 */
export function normalizeHexColor(color: string): string | null {
  // 移除空格
  const trimmed = color.trim();

  // 校验格式
  if (!isValidHexColor(trimmed)) {
    return null;
  }

  // 转换为大写
  return trimmed.toUpperCase();
}

// ---- 派生颜色函数 ----
/**
 * 从主色生成深色变体
 */
function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.max(0, Math.round(r * (1 - amount)));
  const newG = Math.max(0, Math.round(g * (1 - amount)));
  const newB = Math.max(0, Math.round(b * (1 - amount)));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * 从主色生成浅色变体
 */
function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.min(255, Math.round(r + (255 - r) * amount));
  const newG = Math.min(255, Math.round(g + (255 - g) * amount));
  const newB = Math.min(255, Math.round(b + (255 - b) * amount));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * 从主色生成透明变体
 */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 从主色生成所有派生颜色
 */
export function generateThemeColors(primaryColor: string) {
  return {
    primary: primaryColor,
    primaryDeep: darkenColor(primaryColor, 0.1),
    primarySoft: lightenColor(primaryColor, 0.9),
    primaryRing: withAlpha(primaryColor, 0.12),
    primaryShadow: withAlpha(primaryColor, 0.17),
  };
}
