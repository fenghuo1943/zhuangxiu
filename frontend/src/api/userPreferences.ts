/**
 * 用户主题偏好 API 封装
 */
import { apiGet, apiPut } from './client';
import type { ThemePreference } from '../data/theme';

// ---- API 响应类型（snake_case） ----
interface ThemePreferenceResponse {
  color_mode: 'preset' | 'custom';
  preset_color_id: 'coral' | 'jade' | 'ocean' | 'violet' | 'amber' | null;
  primary_color: string;
  desktop_layout: string;
  mobile_layout: string;
  updated_at: string;
}

// ---- 请求类型（camelCase） ----
interface ThemePreferenceInput {
  colorMode: 'preset' | 'custom';
  presetColorId: 'coral' | 'jade' | 'ocean' | 'violet' | 'amber' | null;
  primaryColor: string;
  desktopLayout: string;
  mobileLayout: string;
}

/**
 * 将 API 响应转换为前端类型
 */
function mapResponseToPreference(res: ThemePreferenceResponse): ThemePreference {
  // 旧值迁移：desktop-focus 回退为 desktop-default
  let desktopLayout = res.desktop_layout;
  if (desktopLayout === 'desktop-focus' || desktopLayout !== 'desktop-default' && desktopLayout !== 'desktop-sidebar-workbench') {
    desktopLayout = 'desktop-default';
  }

  return {
    colorMode: res.color_mode,
    presetColorId: res.preset_color_id,
    primaryColor: res.primary_color,
    desktopLayout: desktopLayout as ThemePreference['desktopLayout'],
    mobileLayout: res.mobile_layout as ThemePreference['mobileLayout'],
    updatedAt: res.updated_at,
  };
}

/**
 * 将前端类型转换为 API 请求格式
 */
function mapInputToRequest(input: ThemePreferenceInput) {
  return {
    color_mode: input.colorMode,
    preset_color_id: input.presetColorId,
    primary_color: input.primaryColor,
    desktop_layout: input.desktopLayout,
    mobile_layout: input.mobileLayout,
  };
}

/**
 * 获取当前用户主题偏好
 */
export async function fetchThemePreference(): Promise<ThemePreference> {
  const res = await apiGet<ThemePreferenceResponse>('/api/user-preferences/theme');
  return mapResponseToPreference(res);
}

/**
 * 更新当前用户主题偏好
 */
export async function updateThemePreference(input: ThemePreferenceInput): Promise<ThemePreference> {
  const requestData = mapInputToRequest(input);
  const res = await apiPut<ThemePreferenceResponse>('/api/user-preferences/theme', requestData);
  return mapResponseToPreference(res);
}
