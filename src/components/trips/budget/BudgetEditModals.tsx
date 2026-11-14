import React from 'react';
import { Sliders, X } from 'lucide-react';
import type { Activity } from '../../../types/travel';

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

  return (
    <>
      {/* Modal: Chỉnh sửa tổng hạn mức */}
      {isEditBudgetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Cập nhật hạn mức ngân sách tour</h3>
              <button
                type="button"
                onClick={() => setIsEditBudgetOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSaveTotalBudget} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tổng hạn mức mới (VNĐ)</label>
                <input
                  type="number"
                  min={1000000}
                  step={1000000}
                  required
                  value={newTotalBudget}
                  onChange={(e) => setNewTotalBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-base focus:border-teal-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Sau khi cập nhật, số dư còn lại và tỷ lệ phần trăm sẽ tự động tính toán lại và lưu vào Firestore.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditBudgetOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu hạn mức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tùy chỉnh phân bổ 5 hạng mục */}
      {isEditAllocationsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Tùy chỉnh phân bổ 5 hạng mục (VNĐ)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAllocationsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSaveAllocations} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">1. Vận chuyển &amp; Xe di chuyển</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocTransport}
                  onChange={(e) => setAllocTransport(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">2. Khách sạn &amp; Lưu trú</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocHotel}
                  onChange={(e) => setAllocHotel(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">3. Ẩm thực &amp; Nhà hàng</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocMeal}
                  onChange={(e) => setAllocMeal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">4. Vé tham quan &amp; Trải nghiệm</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocSightseeing}
                  onChange={(e) => setAllocSightseeing(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">5. Dự phòng rủi ro &amp; Bảo hiểm</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocContingency}
                  onChange={(e) => setAllocContingency(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Tổng phân bổ:</span>
                <span className="font-mono text-slate-900">
                  {(allocTransport + allocHotel + allocMeal + allocSightseeing + allocContingency).toLocaleString('vi-VN')} ₫
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditAllocationsOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu phân bổ &amp; Lưu Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sửa chi phí hoạt động */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Cập nhật chi phí hoạt động</h3>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSaveActivityCost} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hoạt động</label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800">
                  {editingActivity.title}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  required
                  value={editedCost}
                  onChange={(e) => setEditedCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:border-teal-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu &amp; Cập nhật Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
