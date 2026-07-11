import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'green';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const cls = `btn btn-${variant} btn-${size} ${className}`;
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
};

export const IconButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
}> = ({ children, onClick, className = '', ariaLabel, title }) => (
  <button
    className={`icon-btn ${className}`}
    onClick={onClick}
    aria-label={ariaLabel}
    title={title}
  >
    {children}
  </button>
);

export default Button;
