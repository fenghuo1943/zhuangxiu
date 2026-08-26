import React, { useState, useEffect } from 'react';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import DesktopSidebarWorkbenchShell from '../layouts/DesktopSidebarWorkbenchShell';
import { useTheme } from '../theme/ThemeProvider';

interface AppShellProps {
  children: React.ReactNode;
  currentPage: string;
  className?: string;
  /** 侧栏工作台页头面包屑（可选，覆盖默认值） */
  eyebrow?: string;
  /** 侧栏工作台页头标题（可选，覆盖默认值） */
  title?: string;
}

/** 各页面在侧栏工作台中的默认页头配置 */
const PAGE_HEADER_DEFAULTS: Record<string, { eyebrow: string; title: string }> = {
  home: { eyebrow: '我的装修', title: '装修总览' },
  flow: { eyebrow: '我的装修', title: '装修流程' },
  purchase: { eyebrow: '我的装修', title: '采购清单' },
  expense: { eyebrow: '我的装修', title: '装修记账' },
  compare: { eyebrow: '我的装修', title: '比价选品' },
  account: { eyebrow: '我的', title: '个人设置' },
  'theme-settings': { eyebrow: '我的', title: '主题与布局' },
  tips: { eyebrow: '辅助工具', title: '装修技巧' },
  tools: { eyebrow: '辅助工具', title: '实用工具' },
};

export const AppShell: React.FC<AppShellProps> = ({ children, currentPage, className = '', eyebrow, title }) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const { preference } = useTheme();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 移动端始终使用移动壳层
  if (isMobile) {
    return (
      <div className={`app-shell ${className}`}>
        <MobileHeader currentPage={currentPage} />
        <main className="main-content">
          {children}
        </main>
        <MobileBottomNav currentPage={currentPage} />
      </div>
    );
  }

  // 桌面端：根据布局偏好选择壳层
  if (preference.desktopLayout === 'desktop-sidebar-workbench') {
    const defaults = PAGE_HEADER_DEFAULTS[currentPage] || { eyebrow: '', title: '装修手记' };
    return (
      <DesktopSidebarWorkbenchShell
        currentPage={currentPage}
        eyebrow={eyebrow ?? defaults.eyebrow}
        title={title ?? defaults.title}
      >
        {children}
      </DesktopSidebarWorkbenchShell>
    );
  }

  // 默认桌面布局
  return (
    <div className={`app-shell ${className}`}>
      <DesktopHeader currentPage={currentPage} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
