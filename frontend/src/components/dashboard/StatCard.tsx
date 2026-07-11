import React from 'react';

interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  sub,
  color,
  className = '',
}) => (
  <div className={`metric-card ${className}`}>
    {icon && <span className="iconbox" style={color ? { background: color } : undefined}>{icon}</span>}
    <span>{label}</span>
    <b>{value}</b>
    {sub && <em>{sub}</em>}
  </div>
);

export default StatCard;
