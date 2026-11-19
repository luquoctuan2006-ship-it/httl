import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Modal, ModalFooter } from '../common/Modal';
import { Field, TextInput } from '../common/Field';
import { isValidJoinCodeFormat, normalizeJoinCode } from '../../utils/trip/tripJoinHelpers';

interface JoinTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDisplayName: string;
  onJoinTrip: (payload: {
    joinCode: string;
    phone?: string;
    specialPreference?: string;
    displayName?: string;
  }) => Promise<void>;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({
  isOpen,
  onClose,
  defaultDisplayName,
  onJoinTrip,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [phone, setPhone] = useState('');
  const [specialPreference, setSpecialPreference] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeJoinCode(joinCode);
    if (!isValidJoinCodeFormat(cleaned)) {
      setErrorMessage('Mã tham gia phải gồm 5–12 ký tự chữ cái hoặc số (ví dụ: V8K4M2).');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await onJoinTrip({
        joinCode: cleaned,
        displayName: displayName.trim() || defaultDisplayName,
        phone: phone.trim() || undefined,
        specialPreference: specialPreference.trim() || undefined,
      });
      setJoinCode('');
      setPhone('');
      setSpecialPreference('');
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tham gia chuyến đi bằng mã này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tham gia chuyến đi bằng mã mời"
      subtitle="Nhập mã do trưởng đoàn hoặc chủ chuyến cung cấp để tham gia với tư cách Hành khách"
      icon={<KeyRound className="w-4 h-4" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
        <Field label="Mã tham gia chuyến đi *" hint="Không phân biệt chữ hoa/thường">
          <TextInput
            type="text"
            required
            autoFocus
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Ví dụ: V8K4M2"
            className="font-mono tracking-[0.18em] uppercase text-sm font-bold"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tên hiển thị trong đoàn">
            <TextInput
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={defaultDisplayName}
            />
          </Field>

          <Field label="Số điện thoại (tùy chọn)">
            <TextInput
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912 345 678"
              className="font-mono"
            />
          </Field>
        </div>

        <Field label="Ghi chú ăn uống / sức khỏe (tùy chọn)">
          <TextInput
            type="text"
            value={specialPreference}
            onChange={(e) => setSpecialPreference(e.target.value)}
            placeholder="Ví dụ: Say xe, ăn chay, đi cùng người thân..."
          />
        </Field>

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {errorMessage}
          </p>
        )}

        <ModalFooter
          onCancel={onClose}
          submitLabel={isSubmitting ? 'Đang tham gia...' : 'Tham gia chuyến đi'}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};
