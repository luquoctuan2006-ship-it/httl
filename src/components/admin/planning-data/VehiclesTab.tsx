import React from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { VehicleItem } from './planningDataTypes';

interface VehiclesTabProps {
  activeSubTab: string;
  isLoadingVehicles: boolean;
  setIsAddVehicleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  vehicles: VehicleItem[];
  handleToggleVehicleStatus: (vehicle: VehicleItem) => Promise<void>;
  handleDeleteVehicle: (id: string, name: string) => Promise<void>;
}

export const VehiclesTab: React.FC<VehiclesTabProps> = (props) => {
  const { activeSubTab, isLoadingVehicles, setIsAddVehicleOpen, vehicles, handleToggleVehicleStatus, handleDeleteVehicle } = props;
  return (
    <>
      {activeSubTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs text-slate-400 font-semibold">
              Quản lý định mức xe, tốc độ trung bình và lượng tiêu hao nhiên liệu phục vụ thuật toán AI
            </span>
            <button
              onClick={() => setIsAddVehicleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Phương Tiện Mới</span>
            </button>
          </div>

          {isLoadingVehicles ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Đang tải danh sách đội xe điều phối...</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.map((v) => (
                <div key={v.id} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">{v.type}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleVehicleStatus(v)}
                        title="Nhấp để chuyển trạng thái"
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                          v.status === 'Sẵn sàng điều phối'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40'
                            : v.status === 'Đang chạy tour'
                            ? 'bg-sky-950 text-sky-300 border-sky-800 hover:bg-sky-900/40'
                            : 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900/40'
                        }`}
                      >
                        {v.status}
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id, v.type)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                        title="Xóa phương tiện"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Tốc độ TB</span>
                      <strong className="text-teal-400">{v.speedAvg}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Sức chứa</span>
                      <strong className="text-white">{v.capacity}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Tiêu hao</span>
                      <strong className="text-amber-400">{v.consumption}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
