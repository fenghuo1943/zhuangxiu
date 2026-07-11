import React from 'react';

interface IconBoxProps {
  children: React.ReactNode;
  size?: number;
  variant?: 'coral' | 'green' | 'blue' | 'amber';
  className?: string;
}

export const IconBox: React.FC<IconBoxProps> = ({
  children,
  size = 36,
  variant = 'coral',
  className = '',
}) => (
  <span
    className={`iconbox iconbox-${variant} ${className}`}
    style={{ width: size, height: size, flexBasis: size }}
  >
    {children}
  </span>
);

export default IconBox;
