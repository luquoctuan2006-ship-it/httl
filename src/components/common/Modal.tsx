import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
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
  icon,
  maxWidth = 'md',
  headerClassName = 'bg-teal-600 text-white',
  scrollable = false,
  hideHeader = false,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-3xl ${MAX_WIDTH_CLASSES[maxWidth]} w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          scrollable ? 'max-h-[92vh] flex flex-col' : ''
        }`}
      >
        {!hideHeader && (
          <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${headerClassName}`}>
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="text-sm font-extrabold">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
              className="p-1 rounded-full hover:bg-white/20 transition"
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
  submitVariant?: 'teal' | 'rose';
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
  submitVariant = 'teal',
  bordered = true,
  align = 'end',
}) => {
  const submitClasses =
    submitVariant === 'rose'
      ? 'bg-rose-600 hover:bg-rose-700'
      : 'bg-teal-600 hover:bg-teal-700';

  return (
    <div
      className={`${bordered ? 'pt-3 border-t border-slate-100' : 'pt-2'} flex items-center ${
        align === 'center' ? 'justify-center' : 'justify-end'
      } gap-2`}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type={submitType}
        onClick={onSubmitClick}
        disabled={disabled}
        className={`px-4 py-2 ${submitClasses} text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50`}
      >
        {submitLabel}
      </button>
    </div>
  );
};
