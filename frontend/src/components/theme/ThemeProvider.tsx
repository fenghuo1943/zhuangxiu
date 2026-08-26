/**
 * 主题上下文 Provider
 * 负责加载、应用、刷新用户主题
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '../../api/useAuth';
import { fetchThemePreference } from '../../api/userPreferences';
import {
  ThemePreference,
  DEFAULT_THEME_PREFERENCE,
  generateThemeColors,
} from '../../data/theme';

// ---- Context 类型 ----
interface ThemeContextValue {
  /** 当前已应用的配置 */
  preference: ThemePreference;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 应用主题（设置页调用） */
  applyTheme: (preference: ThemePreference) => void;
  /** 刷新主题（从服务端重新获取） */
  refreshTheme: () => Promise<void>;
  /** 重置为默认主题（登出时调用） */
  resetThemeToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---- 工具函数 ----
/**
 * 将主题应用到 CSS 变量和 data 属性
 */
function applyThemeToDOM(preference: ThemePreference) {
  const root = document.documentElement;
  const colors = generateThemeColors(preference.primaryColor);

  // 设置 CSS 变量
  root.style.setProperty('--theme-primary', colors.primary);
  root.style.setProperty('--theme-primary-deep', colors.primaryDeep);
  root.style.setProperty('--theme-primary-soft', colors.primarySoft);
  root.style.setProperty('--theme-primary-ring', colors.primaryRing);
  root.style.setProperty('--theme-primary-shadow', colors.primaryShadow);

  // 更新旧的 --fresh-coral 变量（确保兼容性）
  root.style.setProperty('--fresh-coral', colors.primary);
  root.style.setProperty('--fresh-coral-deep', colors.primaryDeep);
  root.style.setProperty('--fresh-coral-soft', colors.primarySoft);

  // 更新 --primary 变量
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-light', colors.primarySoft);

  // 更新按钮阴影
  root.style.setProperty('--fresh-shadow-button', `0 10px 22px ${colors.primaryShadow}`);

  // 设置布局 data 属性
  root.dataset.desktopLayout = preference.desktopLayout;
  root.dataset.mobileLayout = preference.mobileLayout;
}

/**
 * 重置 DOM 为默认主题
 */
function resetDOMToDefault() {
  const root = document.documentElement;

  // 清除所有主题 CSS 变量
  root.style.removeProperty('--theme-primary');
  root.style.removeProperty('--theme-primary-deep');
  root.style.removeProperty('--theme-primary-soft');
  root.style.removeProperty('--theme-primary-ring');
  root.style.removeProperty('--theme-primary-shadow');
  root.style.removeProperty('--fresh-coral');
  root.style.removeProperty('--fresh-coral-deep');
  root.style.removeProperty('--fresh-coral-soft');
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-light');
  root.style.removeProperty('--fresh-shadow-button');

  // 清除布局 data 属性
  delete root.dataset.desktopLayout;
  delete root.dataset.mobileLayout;
}

// ---- Provider 组件 ----
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 应用主题到 DOM
  const applyTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    applyThemeToDOM(pref);
  }, []);

  // 重置为默认主题
  const resetThemeToDefault = useCallback(() => {
    setPreference(DEFAULT_THEME_PREFERENCE);
    resetDOMToDefault();
  }, []);

  // 从服务端刷新主题
  const refreshTheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const pref = await fetchThemePreference();
      applyTheme(pref);
    } catch (err: any) {
      console.error('Failed to fetch theme preference:', err);
      setError(err.message || '获取主题设置失败');
      // 保留默认主题，不阻塞页面
    } finally {
      setLoading(false);
    }
  }, [applyTheme]);

  // 监听认证状态变化
  useEffect(() => {
    if (authLoading) {
      // 认证状态尚未确定，等待
      return;
    }

    if (isLoggedIn) {
      // 已登录：加载主题
      refreshTheme();
    } else {
      // 未登录：重置为默认主题
      resetThemeToDefault();
      setLoading(false);
    }
  }, [isLoggedIn, authLoading, refreshTheme, resetThemeToDefault]);

  // 初始应用默认主题
  useEffect(() => {
    applyThemeToDOM(DEFAULT_THEME_PREFERENCE);
  }, []);

  const value: ThemeContextValue = {
    preference,
    loading,
    error,
    applyTheme,
    refreshTheme,
    resetThemeToDefault,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ---- Hook ----
/**
 * 获取主题上下文
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
