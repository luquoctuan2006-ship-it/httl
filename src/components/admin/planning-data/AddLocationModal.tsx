import React from 'react';
import { MapPin, X, Plus } from 'lucide-react';
import type { NewLocationForm } from './planningDataTypes';

interface AddLocationModalProps {
  isAddModalOpen: boolean;
  setIsAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newLocationForm: NewLocationForm;
  setNewLocationForm: React.Dispatch<React.SetStateAction<NewLocationForm>>;
  handleCreateLocation: (event: React.FormEvent) => Promise<void>;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = (props) => {
  const { isAddModalOpen, setIsAddModalOpen, newLocationForm, setNewLocationForm, handleCreateLocation } = props;
  return (
    <>
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Địa Điểm Du Lịch Mới</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 font-bold block mb-1">Mã Code *</label>
                  <input
                    type="text"
                    required
                    value={newLocationForm.code}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Tên Địa Điểm *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Lăng Tự Đức"
                    value={newLocationForm.name}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Vĩ độ (Lat) *</label>
                  <input
                    type="text"
                    required
                    placeholder="16.4698"
                    value={newLocationForm.lat}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, lat: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Kinh độ (Lng) *</label>
                  <input
                    type="text"
                    required
                    placeholder="107.578"
                    value={newLocationForm.lng}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, lng: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Loại hình</label>
                  <select
                    value={newLocationForm.category}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="culture">🏛️ Văn hóa</option>
                    <option value="nature">🌿 Thiên nhiên</option>
                    <option value="entertainment">🎡 Vui chơi</option>
                    <option value="food">🍜 Ăn uống</option>
                    <option value="stay">🏨 Lưu trú</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giờ mở cửa</label>
                  <input
                    type="text"
                    placeholder="07:30 - 17:30"
                    value={newLocationForm.openHours}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, openHours: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giá vé tham khảo</label>
                  <input
                    type="text"
                    placeholder="150.000 ₫"
                    value={newLocationForm.ticketPrice}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, ticketPrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Mô tả / Lưu ý điều phối</label>
                <textarea
                  rows={2}
                  placeholder="Thông tin đặc điểm, thời lượng khuyến nghị cho AI..."
                  value={newLocationForm.description}
                  onChange={(e) => setNewLocationForm({ ...newLocationForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu Địa Điểm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
