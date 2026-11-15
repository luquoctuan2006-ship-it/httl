import React from 'react';
import { Edit2, X, Check } from 'lucide-react';
import type { Waypoint } from './planningDataTypes';

interface EditLocationModalProps {
  editingWaypoint: Waypoint | null;
  setEditingWaypoint: React.Dispatch<React.SetStateAction<Waypoint | null>>;
  handleSaveEditLocation: (event: React.FormEvent) => Promise<void>;
}

export const EditLocationModal: React.FC<EditLocationModalProps> = (props) => {
  const { editingWaypoint, setEditingWaypoint, handleSaveEditLocation } = props;
  return (
    <>
      {editingWaypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-black text-white text-base">Chỉnh Sửa Địa Điểm</h3>
              </div>
              <button
                onClick={() => setEditingWaypoint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLocation} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 font-bold block mb-1">Mã Code</label>
                  <input
                    type="text"
                    required
                    value={editingWaypoint.code}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Tên Địa Điểm</label>
                  <input
                    type="text"
                    required
                    value={editingWaypoint.name}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingWaypoint.lat}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingWaypoint.lng}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Loại hình</label>
                  <select
                    value={editingWaypoint.category || 'culture'}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, category: e.target.value })}
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
                    value={editingWaypoint.openHours || ''}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, openHours: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giá vé tham khảo</label>
                  <input
                    type="text"
                    value={editingWaypoint.ticketPrice || ''}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, ticketPrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Mô tả / Lưu ý điều phối</label>
                <textarea
                  rows={2}
                  value={editingWaypoint.description || ''}
                  onChange={(e) => setEditingWaypoint({ ...editingWaypoint, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingWaypoint(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg shadow-sky-900/40 transition active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Cập Nhật Địa Điểm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
