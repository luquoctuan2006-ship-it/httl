import React from 'react';

type FieldVariant = 'light' | 'dark';

const LIGHT_CONTROL_CLASSES =
  'w-full px-3 py-2 rounded-xl border border-neutral-200 text-neutral-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 outline-none transition';
const DARK_CONTROL_CLASSES =
  'w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition';

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  variant?: FieldVariant;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  variant = 'light',
  className,
  children,
}) => (
  <div className={className}>
    <label
      className={
        variant === 'dark'
          ? 'text-neutral-300 block mb-1 font-bold'
          : 'block font-bold text-neutral-700 mb-1'
      }
    >
      {label}
    </label>
    {children}
    {hint && <span className="text-[10px] text-neutral-500">{hint}</span>}
  </div>
);

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: FieldVariant;
}

export const TextInput: React.FC<TextInputProps> = ({
  variant = 'light',
  className = '',
  ...props
}) => {
  const base = variant === 'dark' ? DARK_CONTROL_CLASSES : LIGHT_CONTROL_CLASSES;
  return <input {...props} className={`${base} ${className}`.trim()} />;
};

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: FieldVariant;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  variant = 'light',
  className = '',
  children,
  ...props
}) => {
  const base = variant === 'dark' ? DARK_CONTROL_CLASSES : LIGHT_CONTROL_CLASSES;
  return (
    <select {...props} className={`${base} ${className}`.trim()}>
      {children}
    </select>
  );
};

