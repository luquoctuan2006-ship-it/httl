import React from 'react';
import { Sliders } from 'lucide-react';
import type { Activity } from '../../../types/travel';
import { Modal, ModalFooter } from '../../common/Modal';
import { Field, TextInput } from '../../common/Field';

interface BudgetEditModalsProps {
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
  onSaveAllocations: (event: React.FormEvent) => void;
  editingActivity: Activity | null;
  setEditingActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  editedCost: number;
  setEditedCost: React.Dispatch<React.SetStateAction<number>>;
  onSaveActivityCost: (event: React.FormEvent) => void;
}

export function BudgetEditModals(props: BudgetEditModalsProps) {
  const {
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
    onSaveAllocations,
    editingActivity,
    setEditingActivity,
    editedCost,
    setEditedCost,
    onSaveActivityCost,
  } = props;

  const allocationFields = [
    { label: '1. Vận chuyển & Xe di chuyển', value: allocTransport, setter: setAllocTransport },
    { label: '2. Khách sạn & Lưu trú', value: allocHotel, setter: setAllocHotel },
    { label: '3. Ẩm thực & Nhà hàng', value: allocMeal, setter: setAllocMeal },
    { label: '4. Vé tham quan & Trải nghiệm', value: allocSightseeing, setter: setAllocSightseeing },
    { label: '5. Dự phòng rủi ro & Bảo hiểm', value: allocContingency, setter: setAllocContingency },
  ];

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
              min={1000000}
              step={1000000}
              required
              value={newTotalBudget}
              onChange={(e) => setNewTotalBudget(Number(e.target.value))}
              className="font-mono font-bold text-base"
            />
          </Field>
          <p className="text-[11px] text-slate-400">
            Sau khi cập nhật, số dư còn lại và tỷ lệ phần trăm sẽ tự động tính toán lại và lưu vào Firestore.
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
          {allocationFields.map((item) => (
            <Field key={item.label} label={item.label}>
              <TextInput
                type="number"
                min={0}
                step={500000}
                value={item.value}
                onChange={(e) => item.setter(Number(e.target.value))}
                className="font-mono font-bold"
              />
            </Field>
          ))}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Tổng phân bổ:</span>
            <span className="font-mono text-slate-900">
              {(allocTransport + allocHotel + allocMeal + allocSightseeing + allocContingency).toLocaleString('vi-VN')} ₫
            </span>
          </div>

          <ModalFooter
            onCancel={() => setIsEditAllocationsOpen(false)}
            submitLabel="Lưu phân bổ & Lưu Firestore"
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
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800">
              {editingActivity?.title}
            </div>
          </Field>

          <Field label="Số tiền (VNĐ)">
            <TextInput
              type="number"
              min={0}
              step={50000}
              required
              value={editedCost}
              onChange={(e) => setEditedCost(Number(e.target.value))}
              className="font-mono font-bold text-sm"
            />
          </Field>

          <ModalFooter
            onCancel={() => setEditingActivity(null)}
            submitLabel="Lưu & Cập nhật Firestore"
            bordered={false}
          />
        </form>
      </Modal>
    </>
  );
}
