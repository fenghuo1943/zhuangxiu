import React, { useState, useEffect } from 'react';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';

interface AppShellProps {
  children: React.ReactNode;
  currentPage: string;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, currentPage, className = '' }) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`app-shell ${className}`}>
      {isMobile ? (
        <MobileHeader currentPage={currentPage} />
      ) : (
        <DesktopHeader currentPage={currentPage} />
      )}
      <main className="main-content">
        {children}
      </main>
      {isMobile && <MobileBottomNav currentPage={currentPage} />}
    </div>
  );
};

export default AppShell;
