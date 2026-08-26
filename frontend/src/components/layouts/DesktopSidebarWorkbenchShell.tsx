/**
 * 桌面端侧栏工作台壳层
 * 左侧固定导航栏 + 右侧内容区（含粘连页头）
 */
import React from 'react';
import WorkbenchSidebar from './WorkbenchSidebar';
import WorkbenchPageHeader, { PageHeaderAction } from './WorkbenchPageHeader';
import '../../styles/workbench-layout.css';

interface DesktopSidebarWorkbenchShellProps {
  children: React.ReactNode;
  currentPage: string;
  /** 页头面包屑 */
  eyebrow?: string;
  /** 页头标题 */
  title?: string;
  /** 页头主操作 */
  primaryAction?: PageHeaderAction;
  /** 页头次要操作 */
  secondaryActions?: PageHeaderAction[];
}

const DesktopSidebarWorkbenchShell: React.FC<DesktopSidebarWorkbenchShellProps> = ({
  children,
  currentPage,
  eyebrow,
  title,
  primaryAction,
  secondaryActions,
}) => {
  return (
    <div className="wb-shell">
      <WorkbenchSidebar currentPage={currentPage} />
      <div className="wb-content">
        <WorkbenchPageHeader
          eyebrow={eyebrow}
          title={title || '装修手记'}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
        <main className="wb-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DesktopSidebarWorkbenchShell;
