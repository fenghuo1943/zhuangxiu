import React, { useState, useCallback, useEffect } from 'react';

interface NumberInputProps {
  value: number | string;
  onChange: (value: string, num: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const fmt = (n: number): string => {
  if (isNaN(n) || !isFinite(n)) return '';
  // Keep raw value, no thousand-separator on input (would break editing)
  return String(n);
};

export const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, min, max, step = 0.01, placeholder = '0.00',
  className = '', style, disabled, required, id,
}) => {
  const [local, setLocal] = useState(typeof value === 'number' ? fmt(value) : String(value));

  useEffect(() => {
    setLocal(typeof value === 'number' ? fmt(value) : String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    const num = parseFloat(local);
    if (local === '' || isNaN(num)) {
      setLocal('');
      onChange('', 0);
      return;
    }
    let clamped = num;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    setLocal(fmt(clamped));
    onChange(fmt(clamped), clamped);
  }, [local, min, max, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty, digits, single dot, leading minus
    if (raw === '' || raw === '-' || /^-?\d*\.?\d*$/.test(raw)) {
      setLocal(raw);
      const num = parseFloat(raw);
      if (!isNaN(num)) onChange(raw, num);
      else onChange(raw, 0);
    }
  }, [onChange]);

  return (
    <input
      id={id}
      className={`input number-input ${className}`}
      type="text"
      inputMode="decimal"
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      required={required}
    />
  );
};

export default NumberInput;
