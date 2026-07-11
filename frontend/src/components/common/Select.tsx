import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  value, onChange, options, placeholder,
  className = '', style, disabled, id,
}) => (
  <select
    id={id}
    className={`input select-input ${className}`}
    value={value}
    onChange={e => onChange(e.target.value)}
    style={style}
    disabled={disabled}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

export default Select;
