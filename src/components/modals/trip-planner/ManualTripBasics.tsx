import React from 'react';
import { Calendar, Compass } from 'lucide-react';
import type { ManualPlannerTabProps } from './ManualPlannerTab';

type ManualTripBasicsProps = Pick<
  ManualPlannerTabProps,
  | 'tripTitle'
  | 'setTripTitle'
  | 'tripCode'
  | 'setTripCode'
  | 'origin'
  | 'setOrigin'
  | 'destination'
  | 'setDestination'
  | 'startDate'
  | 'setStartDate'
  | 'totalDays'
  | 'onUpdateTotalDays'
  | 'vehicle'
  | 'setVehicle'
  | 'membersCount'
  | 'setMembersCount'
  | 'budgetEstimated'
  | 'setBudgetEstimated'
>;

export function ManualTripBasics(props: ManualTripBasicsProps) {
  const {
    tripTitle,
    setTripTitle,
    tripCode,
    setTripCode,
    origin,
    setOrigin,
    destination,
    setDestination,
    startDate,
    setStartDate,
    totalDays,
    onUpdateTotalDays,
    vehicle,
    setVehicle,
    membersCount,
    setMembersCount,
    budgetEstimated,
    setBudgetEstimated,
  } = props;

  return (
    <>
              {/* Card 1: Thông tin cơ bản chuyến đi */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-600" />
                    <span>1. Thông tin chung của chuyến đi</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Nhập thông tin thực tế</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-8">
                    <label className="block font-bold text-slate-700 mb-1">
                      Tên hành trình chuyến đi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tripTitle}
                      onChange={(e) => setTripTitle(e.target.value)}
                      placeholder="VD: Tour Nha Trang - Đà Lạt 4N3Đ (hoặc tên theo tour thực tế của bạn)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">Mã tour / Chuyến đi</label>
                    <input
                      type="text"
                      value={tripCode}
                      onChange={(e) => setTripCode(e.target.value)}
                      placeholder="VD: NT-DL-01"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">
                      Điểm xuất phát (Origin)
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="VD: TP. Hồ Chí Minh / Hà Nội"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">
                      Điểm đến chính (Destination)
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="VD: Nha Trang / Đà Lạt / Phú Quốc"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">Ngày khởi hành</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Số ngày hành trình</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={totalDays}
                        onChange={(e) => onUpdateTotalDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((d) => (
                          <option key={d} value={d}>
                            {d} ngày ({d > 1 ? `${d - 1} đêm` : 'trong ngày'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Phương tiện di chuyển</label>
                    <select
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none"
                    >
                      <option value="Xe 7 chỗ">Xe 7 chỗ</option>
                      <option value="Xe 16 chỗ Ford Transit">Xe 16 chỗ</option>
                      <option value="Xe 29 chỗ tiêu chuẩn">Xe 29 chỗ</option>
                      <option value="Xe 45 chỗ Universe">Xe 45 chỗ</option>
                      <option value="Máy bay + Xe đưa đón">Máy bay + Xe đưa đón</option>
                      <option value="Tàu hỏa du lịch">Tàu hỏa du lịch</option>
                      <option value="Tàu cao tốc / Du thuyền">Tàu cao tốc / Du thuyền</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Số khách / thành viên</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={membersCount}
                      onChange={(e) => setMembersCount(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Tổng ngân sách dự kiến (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500000}
                      value={budgetEstimated}
                      onChange={(e) =>
                        setBudgetEstimated(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="VD: 30000000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>


    </>
  );
}
