import React from 'react';
import { Bus, X } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import type { FleetVehicleOption } from './mapHelpers';

interface TelematicsEditorModalProps {
  trip: TripData;
  isEditTelematicsOpen: boolean;
  setIsEditTelematicsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveTelematics: (event: React.FormEvent) => void;
  fleetVehicles: FleetVehicleOption[];
  telVehicleId: string;
  setTelVehicleId: React.Dispatch<React.SetStateAction<string>>;
  telDriverMemberId: string;
  setTelDriverMemberId: React.Dispatch<React.SetStateAction<string>>;
  telDriver: string;
  setTelDriver: React.Dispatch<React.SetStateAction<string>>;
  telDriverPhone: string;
  setTelDriverPhone: React.Dispatch<React.SetStateAction<string>>;
  telVehicleType: string;
  setTelVehicleType: React.Dispatch<React.SetStateAction<string>>;
  telPlate: string;
  setTelPlate: React.Dispatch<React.SetStateAction<string>>;
  telFrom: string;
  setTelFrom: React.Dispatch<React.SetStateAction<string>>;
  telTo: string;
  setTelTo: React.Dispatch<React.SetStateAction<string>>;
  telPassengers: number;
  setTelPassengers: React.Dispatch<React.SetStateAction<number>>;
}

export const TelematicsEditorModal: React.FC<TelematicsEditorModalProps> = (props) => {
  const { trip, isEditTelematicsOpen, setIsEditTelematicsOpen, handleSaveTelematics, fleetVehicles, telVehicleId, setTelVehicleId, telDriverMemberId, setTelDriverMemberId, telDriver, setTelDriver, telDriverPhone, setTelDriverPhone, telVehicleType, setTelVehicleType, telPlate, setTelPlate, telFrom, setTelFrom, telTo, setTelTo, telPassengers, setTelPassengers } = props;
  return (
    <>
{isEditTelematicsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Cập nhật thông tin xe</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTelematicsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTelematics} className="p-6 space-y-3.5 text-xs">
              {fleetVehicles.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chọn nhanh từ đội xe hệ thống</label>
                  <select
                    value={telVehicleId}
                    onChange={(e) => {
                      const pickedId = e.target.value;
                      setTelVehicleId(pickedId);
                      const picked = fleetVehicles.find((v) => v.id === pickedId);
                      if (picked) {
                        setTelVehicleType(picked.type);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    <option value="">— Nhập thủ công hoặc chọn xe đội —</option>
                    {fleetVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.type} ({v.capacity}) — {v.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {trip.members.some((m) => m.role === 'Tài xế') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chọn tài xế từ thành viên đoàn</label>
                  <select
                    value={telDriverMemberId}
                    onChange={(e) => {
                      const memberId = e.target.value;
                      setTelDriverMemberId(memberId);
                      const m = trip.members.find((item) => item.id === memberId);
                      if (m) {
                        setTelDriver(m.name);
                        setTelDriverPhone(m.phone || '');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    <option value="">— Chọn tài xế hoặc nhập tay bên dưới —</option>
                    {trip.members
                      .filter((m) => m.role === 'Tài xế')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.phone ? ` (${m.phone})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tài xế phụ trách *</label>
                  <input
                    type="text"
                    required
                    value={telDriver}
                    onChange={(e) => {
                      setTelDriver(e.target.value);
                      setTelDriverMemberId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SĐT tài xế *</label>
                  <input
                    type="tel"
                    value={telDriverPhone}
                    onChange={(e) => setTelDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại phương tiện</label>
                  <input
                    type="text"
                    value={telVehicleType}
                    onChange={(e) => {
                      setTelVehicleType(e.target.value);
                      setTelVehicleId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Biển số xe</label>
                  <input
                    type="text"
                    value={telPlate}
                    onChange={(e) => setTelPlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Điểm xuất phát chặng</label>
                  <input
                    type="text"
                    value={telFrom}
                    onChange={(e) => setTelFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Điểm đến tiếp theo</label>
                  <input
                    type="text"
                    value={telTo}
                    onChange={(e) => setTelTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Khách trên xe</label>
                <input
                  type="number"
                  min={1}
                  value={telPassengers}
                  onChange={(e) => setTelPassengers(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditTelematicsOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
