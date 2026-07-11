import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => (
  <div className={`section-header ${className}`}>
    <div className="section-header-left">
      <h3>{title}</h3>
      {subtitle && <span className="section-header-sub">{subtitle}</span>}
    </div>
    {action && <div className="section-header-action">{action}</div>}
  </div>
);

export default SectionHeader;
