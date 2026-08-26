/**
 * 侧栏工作台 - 页面页头
 * 显示面包屑/业务域、页面标题和主操作
 */
import React from 'react';

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface WorkbenchPageHeaderProps {
  /** 业务域 / 面包屑 */
  eyebrow?: string;
  /** 页面标题 */
  title: string;
  /** 主操作按钮 */
  primaryAction?: PageHeaderAction;
  /** 次要操作按钮 */
  secondaryActions?: PageHeaderAction[];
}

const WorkbenchPageHeader: React.FC<WorkbenchPageHeaderProps> = ({
  eyebrow,
  title,
  primaryAction,
  secondaryActions,
}) => {
  return (
    <header className="wb-page-header">
      <div className="wb-page-header-left">
        {eyebrow && <div className="wb-page-eyebrow">{eyebrow}</div>}
        <h1 className="wb-page-title">{title}</h1>
      </div>
      <div className="wb-page-header-right">
        {secondaryActions?.map((action, i) => (
          <button
            key={i}
            className="btn btn-outline wb-header-btn"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
        {primaryAction && (
          <button
            className="btn btn-primary wb-header-btn"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.icon}
            {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  );
};

export default WorkbenchPageHeader;
