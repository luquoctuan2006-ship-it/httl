import React from 'react';
import { Car, X, Plus } from 'lucide-react';
import type { NewVehicleForm } from './planningDataTypes';

interface AddVehicleModalProps {
  isAddVehicleOpen: boolean;
  setIsAddVehicleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newVehicleForm: NewVehicleForm;
  setNewVehicleForm: React.Dispatch<React.SetStateAction<NewVehicleForm>>;
  handleCreateVehicle: (event: React.FormEvent) => Promise<void>;
}

export const AddVehicleModal: React.FC<AddVehicleModalProps> = (props) => {
  const { isAddVehicleOpen, setIsAddVehicleOpen, newVehicleForm, setNewVehicleForm, handleCreateVehicle } = props;
  return (
    <>
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Phương Tiện Mới</h3>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Loại xe & Dòng xe *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Xe du lịch 35 chỗ (Thaco Town)"
                  value={newVehicleForm.type}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tốc độ TB (km/h)</label>
                  <input
                    type="text"
                    required
                    placeholder="45 km/h"
                    value={newVehicleForm.speedAvg}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, speedAvg: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Sức chứa tối đa</label>
                  <input
                    type="text"
                    required
                    placeholder="28 khách"
                    value={newVehicleForm.capacity}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, capacity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Định mức nhiên liệu</label>
                  <input
                    type="text"
                    placeholder="15L / 100km"
                    value={newVehicleForm.consumption}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, consumption: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Trạng thái ban đầu</label>
                  <select
                    value={newVehicleForm.status}
                    onChange={(e: any) => setNewVehicleForm({ ...newVehicleForm, status: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="Sẵn sàng điều phối">Sẵn sàng điều phối</option>
                    <option value="Đang chạy tour">Đang chạy tour</option>
                    <option value="Bảo dưỡng định kỳ">Bảo dưỡng định kỳ</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Phương Tiện</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
