import React from 'react';

interface DateInputProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value, onChange, min, max,
  className = '', style, disabled, required, id,
}) => (
  <input
    id={id}
    className={`input date-input ${className}`}
    type="date"
    value={value}
    onChange={e => onChange(e.target.value)}
    min={min}
    max={max}
    style={style}
    disabled={disabled}
    required={required}
  />
);

/** Get today as YYYY-MM-DD */
export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export default DateInput;
