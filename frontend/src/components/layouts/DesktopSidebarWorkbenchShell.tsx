/**
 * 桌面端侧栏工作台壳层
 * 左侧固定导航栏 + 右侧内容区
 */
import React from 'react';
import WorkbenchSidebar from './WorkbenchSidebar';
import '../../styles/workbench-layout.css';

interface DesktopSidebarWorkbenchShellProps {
  children: React.ReactNode;
  currentPage: string;
}

const DesktopSidebarWorkbenchShell: React.FC<DesktopSidebarWorkbenchShellProps> = ({
  children,
  currentPage,
}) => {
  return (
    <div className="wb-shell">
      <WorkbenchSidebar currentPage={currentPage} />
      <div className="wb-content">
        <main className="wb-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DesktopSidebarWorkbenchShell;
