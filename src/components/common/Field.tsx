import React from 'react';

type FieldVariant = 'light' | 'dark';

const LIGHT_CONTROL_CLASSES =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none';
const DARK_CONTROL_CLASSES =
  'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500';

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
          ? 'text-slate-300 block mb-1 font-bold'
          : 'block font-bold text-slate-700 mb-1'
      }
    >
      {label}
    </label>
    {children}
    {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
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

interface DarkSectionCardProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const DarkSectionCard: React.FC<DarkSectionCardProps> = ({
  title,
  icon,
  children,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
    <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
      {icon}
      <h3>{title}</h3>
    </div>
    {children}
  </div>
);

interface DarkCheckboxTileProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const DarkCheckboxTile: React.FC<DarkCheckboxTileProps> = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded accent-teal-500"
    />
    <span className="text-slate-200">{label}</span>
  </label>
);
