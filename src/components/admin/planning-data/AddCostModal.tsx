import React from 'react';
import { DollarSign, X, Plus } from 'lucide-react';
import type { NewCostForm } from './planningDataTypes';

interface AddCostModalProps {
  isAddCostOpen: boolean;
  setIsAddCostOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newCostForm: NewCostForm;
  setNewCostForm: React.Dispatch<React.SetStateAction<NewCostForm>>;
  handleCreateCost: (event: React.FormEvent) => Promise<void>;
}

export const AddCostModal: React.FC<AddCostModalProps> = (props) => {
  const { isAddCostOpen, setIsAddCostOpen, newCostForm, setNewCostForm, handleCreateCost } = props;
  return (
    <>
      {isAddCostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                <h3 className="font-black text-white text-base">Thêm Định Mức Chi Phí</h3>
              </div>
              <button
                onClick={() => setIsAddCostOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCost} className="space-y-3.5 text-xs">
              <div>
                <label className="text-neutral-300 font-bold block mb-1">Hạng mục chi tiêu</label>
                <select
                  value={newCostForm.category}
                  onChange={(e) => setNewCostForm({ ...newCostForm, category: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Vé tham quan">Vé tham quan</option>
                  <option value="Ăn uống">Ăn uống</option>
                  <option value="Lưu trú">Lưu trú</option>
                  <option value="Phương tiện">Phương tiện</option>
                  <option value="Hướng dẫn viên">Hướng dẫn viên</option>
                  <option value="Dự phòng">Dự phòng</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1">Tên dịch vụ / Khoản mục *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Buffet trưa nhà hàng 4 sao"
                  value={newCostForm.item}
                  onChange={(e) => setNewCostForm({ ...newCostForm, item: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1">Đơn giá tham khảo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 250.000 ₫ / suất"
                  value={newCostForm.price}
                  onChange={(e) => setNewCostForm({ ...newCostForm, price: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1">Ghi chú định mức</label>
                <input
                  type="text"
                  placeholder="Áp dụng cho đoàn từ 10 khách trở lên..."
                  value={newCostForm.note}
                  onChange={(e) => setNewCostForm({ ...newCostForm, note: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCostOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu Định Mức</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
