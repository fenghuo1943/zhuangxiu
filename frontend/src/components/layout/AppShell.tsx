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
}

export const AppShell: React.FC<AppShellProps> = ({ children, currentPage, className = '' }) => {
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
    return (
      <DesktopSidebarWorkbenchShell
        currentPage={currentPage}
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
