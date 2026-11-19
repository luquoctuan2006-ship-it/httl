import React, { useEffect, useState } from 'react';
import { Sliders } from 'lucide-react';
import type { Activity } from '../../../types/travel';
import { Modal, ModalFooter } from '../../common/Modal';
import { Field, TextInput } from '../../common/Field';

interface BudgetEditModalsProps {
  totalBudget: number;
  hasCustomAllocations?: boolean;
  isEditBudgetOpen: boolean;
  setIsEditBudgetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newTotalBudget: number;
  setNewTotalBudget: React.Dispatch<React.SetStateAction<number>>;
  onSaveTotalBudget: (event: React.FormEvent) => void;
  isEditAllocationsOpen: boolean;
  setIsEditAllocationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  allocTransport: number;
  setAllocTransport: React.Dispatch<React.SetStateAction<number>>;
  allocHotel: number;
  setAllocHotel: React.Dispatch<React.SetStateAction<number>>;
  allocMeal: number;
  setAllocMeal: React.Dispatch<React.SetStateAction<number>>;
  allocSightseeing: number;
  setAllocSightseeing: React.Dispatch<React.SetStateAction<number>>;
  allocContingency: number;
  setAllocContingency: React.Dispatch<React.SetStateAction<number>>;
  allocValidationError?: string | null;
  onSaveAllocations: (event: React.FormEvent) => void;
  onResetAllocationsToDefault: () => void;
  editingActivity: Activity | null;
  setEditingActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  editedCost: number;
  setEditedCost: React.Dispatch<React.SetStateAction<number>>;
  onSaveActivityCost: (event: React.FormEvent) => void;
}

export function BudgetEditModals(props: BudgetEditModalsProps) {
  const {
    totalBudget,
    hasCustomAllocations = false,
    isEditBudgetOpen,
    setIsEditBudgetOpen,
    newTotalBudget,
    setNewTotalBudget,
    onSaveTotalBudget,
    isEditAllocationsOpen,
    setIsEditAllocationsOpen,
    allocTransport,
    setAllocTransport,
    allocHotel,
    setAllocHotel,
    allocMeal,
    setAllocMeal,
    allocSightseeing,
    setAllocSightseeing,
    allocContingency,
    setAllocContingency,
    allocValidationError,
    onSaveAllocations,
    onResetAllocationsToDefault,
    editingActivity,
    setEditingActivity,
    editedCost,
    setEditedCost,
    onSaveActivityCost,
  } = props;

  // Giữ chuỗi nhập tạm để xóa trắng số dễ dàng, không bị tự điền số 0 kẹt phía trước
  const [allocDrafts, setAllocDrafts] = useState<[string, string, string, string, string]>(() => [
    String(allocTransport),
    String(allocHotel),
    String(allocMeal),
    String(allocSightseeing),
    String(allocContingency),
  ]);
  const [editedCostDraft, setEditedCostDraft] = useState<string>(() => String(editedCost));

  useEffect(() => {
    if (isEditAllocationsOpen) {
      setAllocDrafts([
        String(allocTransport),
        String(allocHotel),
        String(allocMeal),
        String(allocSightseeing),
        String(allocContingency),
      ]);
    }
  }, [isEditAllocationsOpen]);

  useEffect(() => {
    if (editingActivity) {
      setEditedCostDraft(String(editedCost));
    }
  }, [editingActivity]);

  const handleResetWithSync = () => {
    onResetAllocationsToDefault();
    const base = totalBudget || 0;
    setAllocDrafts([
      String(Math.round(base * 0.28)),
      String(Math.round(base * 0.35)),
      String(Math.round(base * 0.22)),
      String(Math.round(base * 0.10)),
      String(Math.round(base * 0.05)),
    ]);
  };

  const allocationFields: Array<{
    idx: 0 | 1 | 2 | 3 | 4;
    label: string;
    setter: React.Dispatch<React.SetStateAction<number>>;
  }> = [
    { idx: 0, label: '1. Vận chuyển & Xe di chuyển (mặc định 28%)', setter: setAllocTransport },
    { idx: 1, label: '2. Khách sạn & Lưu trú (mặc định 35%)', setter: setAllocHotel },
    { idx: 2, label: '3. Ẩm thực & Nhà hàng (mặc định 22%)', setter: setAllocMeal },
    { idx: 3, label: '4. Vé tham quan & Trải nghiệm (mặc định 10%)', setter: setAllocSightseeing },
    { idx: 4, label: '5. Dự phòng rủi ro & Bảo hiểm (mặc định 5%)', setter: setAllocContingency },
  ];

  const allocationsSum =
    (Number.isFinite(allocTransport) ? allocTransport : 0) +
    (Number.isFinite(allocHotel) ? allocHotel : 0) +
    (Number.isFinite(allocMeal) ? allocMeal : 0) +
    (Number.isFinite(allocSightseeing) ? allocSightseeing : 0) +
    (Number.isFinite(allocContingency) ? allocContingency : 0);
  const allocationDelta = allocationsSum - totalBudget;
  const isAllocOverTotal = totalBudget > 0 && allocationDelta > 0;

  return (
    <>
      {/* Modal: Chỉnh sửa tổng hạn mức */}
      <Modal
        isOpen={isEditBudgetOpen}
        onClose={() => setIsEditBudgetOpen(false)}
        title="Cập nhật hạn mức ngân sách tour"
        maxWidth="sm"
      >
        <form onSubmit={onSaveTotalBudget} className="p-6 space-y-4 text-xs">
          <Field label="Tổng hạn mức mới (VNĐ)">
            <TextInput
              type="number"
              min={1}
              step={1}
              required
              value={newTotalBudget > 0 ? newTotalBudget : ''}
              onChange={(e) => setNewTotalBudget(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="VD: 48600000"
              className="font-mono font-bold text-base"
            />
          </Field>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Nhập số tiền tùy ý bằng VNĐ. Sau khi cập nhật, số dư còn lại, tỷ lệ phần trăm và cảnh báo vượt mức sẽ tự động tính lại.
            {hasCustomAllocations && ' Các hạn mức 5 hạng mục tùy chỉnh sẽ tự động co giãn tương ứng theo tổng mới.'}
          </p>

          <ModalFooter
            onCancel={() => setIsEditBudgetOpen(false)}
            submitLabel="Lưu hạn mức"
            bordered={false}
          />
        </form>
      </Modal>

      {/* Modal: Tùy chỉnh phân bổ 5 hạng mục */}
      <Modal
        isOpen={isEditAllocationsOpen}
        onClose={() => setIsEditAllocationsOpen(false)}
        title="Tùy chỉnh phân bổ 5 hạng mục (VNĐ)"
        icon={<Sliders className="w-4 h-4" />}
      >
        <form onSubmit={onSaveAllocations} className="p-6 space-y-3.5 text-xs">
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>Đặt hạn mức riêng cho từng hạng mục (tổng ≤ tổng ngân sách tour):</span>
            <button
              type="button"
              onClick={handleResetWithSync}
              className="font-bold text-blue-700 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Chia lại theo % chuẩn
            </button>
          </div>

          {allocationFields.map((item) => (
            <Field key={item.label} label={item.label}>
              <TextInput
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={allocDrafts[item.idx]}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAllocDrafts((prev) => {
                    const next = [...prev] as [string, string, string, string, string];
                    next[item.idx] = raw;
                    return next;
                  });
                  item.setter(raw === '' ? 0 : Math.max(0, Number(raw) || 0));
                }}
                className="font-mono font-bold"
              />
            </Field>
          ))}

          <div className="pt-2 border-t border-neutral-100 space-y-1 text-[11px]">
            <div className="flex items-center justify-between font-bold text-neutral-500">
              <span>Tổng phân bổ 5 hạng mục:</span>
              <span className={`font-mono ${isAllocOverTotal ? 'text-red-600' : 'text-neutral-950'}`}>
                {allocationsSum.toLocaleString('vi-VN')} ₫
              </span>
            </div>
            {totalBudget > 0 && (
              <div className="flex items-center justify-between font-medium text-neutral-500">
                <span>Tổng ngân sách tour hiện tại:</span>
                <span className="font-mono text-neutral-800">{totalBudget.toLocaleString('vi-VN')} ₫</span>
              </div>
            )}
            {totalBudget > 0 && allocationDelta !== 0 && (
              <p
                role={isAllocOverTotal ? 'alert' : undefined}
                className={`font-semibold pt-1 ${
                  isAllocOverTotal ? 'text-red-600' : 'text-neutral-500'
                }`}
              >
                {isAllocOverTotal
                  ? `Không thể lưu: Tổng phân bổ vượt tổng ngân sách tour +${allocationDelta.toLocaleString('vi-VN')} ₫. Hãy giảm bớt hạn mức các hạng mục hoặc nâng tổng ngân sách trước.`
                  : `Còn ${Math.abs(allocationDelta).toLocaleString('vi-VN')} ₫ chưa phân bổ vào 5 hạng mục.`}
              </p>
            )}
            {allocValidationError && !isAllocOverTotal && (
              <p role="alert" className="font-semibold pt-1 text-red-600">
                {allocValidationError}
              </p>
            )}
          </div>

          <ModalFooter
            onCancel={() => setIsEditAllocationsOpen(false)}
            disabled={isAllocOverTotal}
            submitLabel="Lưu phân bổ hạn mức"
            bordered={false}
          />
        </form>
      </Modal>

      {/* Modal: Sửa chi phí hoạt động */}
      <Modal
        isOpen={Boolean(editingActivity)}
        onClose={() => setEditingActivity(null)}
        title="Cập nhật chi phí hoạt động"
        maxWidth="sm"
      >
        <form onSubmit={onSaveActivityCost} className="p-6 space-y-4 text-xs">
          <Field label="Hoạt động">
            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-bold text-neutral-900">
              {editingActivity?.title}
            </div>
          </Field>

          <Field label="Số tiền (VNĐ)">
            <TextInput
              type="number"
              min={0}
              step={1}
              required
              placeholder="0"
              value={editedCostDraft}
              onChange={(e) => {
                const raw = e.target.value;
                setEditedCostDraft(raw);
                setEditedCost(raw === '' ? 0 : Math.max(0, Number(raw) || 0));
              }}
              className="font-mono font-bold text-sm"
            />
          </Field>

          <ModalFooter
            onCancel={() => setEditingActivity(null)}
            submitLabel="Lưu chi phí hoạt động"
            bordered={false}
          />
        </form>
      </Modal>
    </>
  );
}
