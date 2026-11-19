import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  headerClassName?: string;
  scrollable?: boolean;
  hideHeader?: boolean;
  children: React.ReactNode;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'md',
  headerClassName = 'bg-neutral-950 text-white border-b-2 border-blue-600',
  scrollable = false,
  hideHeader = false,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        className={`bg-white text-neutral-900 rounded-3xl ${MAX_WIDTH_CLASSES[maxWidth]} w-full border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          scrollable ? 'max-h-[92vh] flex flex-col' : ''
        }`}
      >
        {!hideHeader && (
          <div className={`px-6 py-4 flex items-center justify-between gap-3 shrink-0 ${headerClassName}`}>
            <div className="flex items-start gap-2.5 min-w-0">
              {icon && <span className="mt-0.5 shrink-0 text-blue-400">{icon}</span>}
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold">{title}</h3>
                {subtitle && <p className="text-[11px] opacity-85 font-medium mt-0.5 leading-snug">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
              className="p-1.5 rounded-lg hover:bg-white/15 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

interface ModalFooterProps {
  cancelLabel?: string;
  onCancel: () => void;
  submitLabel: React.ReactNode;
  submitType?: 'submit' | 'button';
  onSubmitClick?: () => void;
  disabled?: boolean;
  cancelDisabled?: boolean;
  submitVariant?: 'teal' | 'rose' | 'blue' | 'red';
  bordered?: boolean;
  align?: 'end' | 'center';
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  cancelLabel = 'Hủy',
  onCancel,
  submitLabel,
  submitType = 'submit',
  onSubmitClick,
  disabled = false,
  cancelDisabled = false,
  submitVariant = 'blue',
  bordered = true,
  align = 'end',
}) => {
  const submitClasses =
    submitVariant === 'rose' || submitVariant === 'red'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div
      className={`${bordered ? 'pt-3 border-t border-neutral-100' : 'pt-2'} flex items-center ${
        align === 'center' ? 'justify-center' : 'justify-end'
      } gap-2`}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="px-4 py-2 rounded-xl font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 cursor-pointer"
      >
        {cancelLabel}
      </button>
      <button
        type={submitType}
        onClick={onSubmitClick}
        disabled={disabled}
        className={`px-4 py-2 ${submitClasses} text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50 cursor-pointer`}
      >
        {submitLabel}
      </button>
    </div>
  );
};
