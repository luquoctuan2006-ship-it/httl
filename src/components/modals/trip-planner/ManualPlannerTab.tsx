import React from 'react';
import { ManualTripBasics } from './ManualTripBasics';
import { ManualActivityForm } from './ManualActivityForm';
import { ManualActivitiesList } from './ManualActivitiesList';
import { getActivityTypeIcon, getActivityTypeLabel } from './activityTypeDisplay';
import {
  Calendar,
  Check,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Activity, DaySchedule } from '../../../types/travel';

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface ManualPlannerTabProps {
  isActive: boolean;
  tripTitle: string;
  setTripTitle: StateSetter<string>;
  tripCode: string;
  setTripCode: StateSetter<string>;
  origin: string;
  setOrigin: StateSetter<string>;
  destination: string;
  setDestination: StateSetter<string>;
  startDate: string;
  setStartDate: StateSetter<string>;
  totalDays: number;
  onUpdateTotalDays: (days: number) => void;
  vehicle: string;
  setVehicle: StateSetter<string>;
  membersCount: number;
  setMembersCount: StateSetter<number>;
  budgetEstimated: number | '';
  setBudgetEstimated: StateSetter<number | ''>;
  manualDays: DaySchedule[];
  activeDayIndex: number;
  setActiveDayIndex: StateSetter<number>;
  currentDay: DaySchedule;
  onAddNewDay: () => void;
  onDeleteActiveDay: (dayIndex: number) => void;
  onAutoArrangeCurrentDay: () => void;
  onOpenAddActivity: () => void;
  isActivityFormOpen: boolean;
  setIsActivityFormOpen: StateSetter<boolean>;
  onSaveActivity: (event: React.FormEvent) => void;
  actFormError: string | null;
  editingActivityId: string | null;
  actTitle: string;
  setActTitle: StateSetter<string>;
  actType: Activity['type'];
  setActType: StateSetter<Activity['type']>;
  actTimeStart: string;
  setActTimeStart: StateSetter<string>;
  actTimeEnd: string;
  setActTimeEnd: StateSetter<string>;
  actLocation: string;
  setActLocation: StateSetter<string>;
  actCost: number | '';
  setActCost: StateSetter<number | ''>;
  actDetails: string;
  setActDetails: StateSetter<string>;
  setManualDays: StateSetter<DaySchedule[]>;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  totalActivitiesCount: number;
  totalCalculatedCost: number;
  onApplyTraditionalSchedule: () => void;
  isSaving: boolean;
}

export function ManualPlannerTab(props: ManualPlannerTabProps) {
  const {
    isActive,
    totalDays,
    budgetEstimated,
    manualDays,
    activeDayIndex,
    setActiveDayIndex,
    currentDay,
    onAddNewDay,
    onDeleteActiveDay,
    onAutoArrangeCurrentDay,
    onOpenAddActivity,
    setIsActivityFormOpen,
    setManualDays,
    onEditActivity,
    onDeleteActivity,
    totalActivitiesCount,
    totalCalculatedCost,
    onApplyTraditionalSchedule,
    isSaving,
  } = props;

  return (
    <>
          {isActive && (
            <div className="space-y-5">
              <ManualTripBasics {...props} />
              {/* Card 2: Thiết kế lịch trình chi tiết từng ngày */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>2. Chi tiết các hoạt động theo ngày ({manualDays.length} ngày)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onAddNewDay}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm ngày mới</span>
                    </button>
                    {manualDays.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteActiveDay(activeDayIndex)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                        title="Xóa ngày hiện tại"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa Ngày {activeDayIndex}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {manualDays.map((day) => {
                    const isSelected = day.dayIndex === activeDayIndex;
                    return (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => {
                          setActiveDayIndex(day.dayIndex);
                          setIsActivityFormOpen(false);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>Ngày {day.dayIndex}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {day.activities.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Day Header & Actions */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Chủ đề / Ghi chú Ngày {activeDayIndex}:
                    </label>
                    <input
                      type="text"
                      value={currentDay.fullDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualDays((prev) =>
                          prev.map((d) => (d.dayIndex === activeDayIndex ? { ...d, fullDate: val } : d))
                        );
                      }}
                      placeholder="VD: Ngày 1: Đón đoàn & tham quan Tháp Bà Ponagar"
                      className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none text-xs py-0.5"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={onAutoArrangeCurrentDay}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                      title="Tự động kiểm tra và sắp xếp lại khung giờ của ngày này nếu có xung đột"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>⚡ Tự động xếp lịch ngày này</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenAddActivity}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm hoạt động</span>
                    </button>
                  </div>
                </div>

                <ManualActivityForm {...props} />

                <ManualActivitiesList currentDay={currentDay} activeDayIndex={activeDayIndex} onEditActivity={onEditActivity} onDeleteActivity={onDeleteActivity} getActivityTypeIcon={getActivityTypeIcon} getActivityTypeLabel={getActivityTypeLabel} />

              </div>

              {/* Bottom Summary Bar & Save Button */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tổng hoạt động:</span>
                    <strong className="text-white text-sm font-black">
                      {totalActivitiesCount} hoạt động
                    </strong>
                  </div>
                  <div className="border-l border-slate-700 pl-4">
                    <span className="text-slate-400 block text-[10px]">Chi phí các hoạt động:</span>
                    <strong className="text-emerald-400 text-sm font-mono font-black">
                      {totalCalculatedCost.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                  {typeof budgetEstimated === 'number' && budgetEstimated > 0 && (
                    <div className="border-l border-slate-700 pl-4">
                      <span className="text-slate-400 block text-[10px]">Ngân sách dự kiến:</span>
                      <strong className="text-amber-300 text-sm font-mono font-black">
                        {budgetEstimated.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onApplyTraditionalSchedule}
                  disabled={isSaving}
                  className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Đang lưu chuyến đi...'
                      : `Hoàn tất & Khởi tạo Tour (${totalDays} ngày)`}
                  </span>
                </button>
              </div>
            </div>
          )}
    </>
  );
}
