import React from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Coffee,
  Landmark,
  Mountain,
  Bus,
  UtensilsCrossed,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Pin
} from 'lucide-react';
import { DaySchedule, Activity } from '../types/travel';

interface TimelineScheduleProps {
  days: DaySchedule[];
  currentDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  onAddActivity: () => void;
  onSelectActivity: (activity: Activity) => void;
  filterMode: 'timeline' | 'all';
  onToggleFilterMode: () => void;
  canAddActivity?: boolean;
}

export const TimelineSchedule: React.FC<TimelineScheduleProps> = ({
  days,
  currentDayIndex,
  onSelectDay,
  onAddActivity,
  onSelectActivity,
  filterMode,
  onToggleFilterMode,
  canAddActivity = true,
}) => {
  const currentDay = days.find((d) => d.dayIndex === currentDayIndex) || days[0];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'meal':
        return <Coffee className="w-4 h-4 text-emerald-600" />;
      case 'hotel':
      case 'checkin':
        return <UtensilsCrossed className="w-4 h-4 text-purple-600" />;
      case 'transport':
        return <Bus className="w-4 h-4 text-amber-600" />;
      case 'sightseeing':
        return <Mountain className="w-4 h-4 text-teal-600" />;
      default:
        return <Landmark className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: Activity['status']) => {
    switch (status) {
      case 'Hoàn tất':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Hoàn tất
          </span>
        );
      case 'Đang diễn ra':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            Đang diễn ra
          </span>
        );
      case 'Cần xử lý':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Cần xử lý
          </span>
        );
      case 'Đã xác nhận':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Đã xác nhận
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
      {/* Top Header of Detail Schedule */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              Lịch trình chi tiết
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {currentDay.fullDate} • Ngày {currentDay.dayIndex} trên hành trình
            </p>
          </div>
        </div>

        {/* Day Selector Tabs & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Day Tabs */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl gap-1">
            {days.map((day) => {
              const isActive = day.dayIndex === currentDayIndex;
              return (
                <button
                  key={day.dayIndex}
                  onClick={() => onSelectDay(day.dayIndex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{day.dayName} {day.dateNum}</span>
                  {day.hasWarning && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-amber-300' : 'bg-amber-500'
                      }`}
                    ></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFilterMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{filterMode === 'timeline' ? 'Theo thời gian' : 'Tất cả'}</span>
            </button>

            {canAddActivity && (
              <button
                onClick={onAddActivity}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm hoạt động</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Current Indicator Bar */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-4 text-xs font-semibold text-slate-400">
        <span className="font-mono text-slate-500 font-bold shrink-0">06:00</span>
        
        <div className="flex-1 relative flex items-center justify-center">
          <div className="w-full h-0.5 bg-slate-200 rounded-full"></div>
          {/* Current time marker badge */}
          <div className="absolute px-3 py-1 bg-[#0F766E] text-white rounded-full text-[11px] font-black tracking-wide shadow-md flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping"></span>
            <span>09:42 HIỆN TẠI</span>
          </div>
        </div>

        <span className="font-mono text-slate-500 font-bold shrink-0">20:00</span>
      </div>

      {/* Activity Cards Row */}
      <div className="p-4 sm:p-5 overflow-x-auto scrollbar-thin">
        <div className="flex gap-4 min-w-[980px] pb-1">
          {currentDay.activities.map((activity) => {
            const isOngoing = activity.status === 'Đang diễn ra';
            return (
              <div
                key={activity.id}
                onClick={() => onSelectActivity(activity)}
                className={`flex-1 min-w-[210px] rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isOngoing
                    ? 'bg-white border-2 border-teal-500 shadow-md ring-4 ring-teal-500/10'
                    : 'bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Time & Status Badge */}
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <span className="text-xs font-mono font-extrabold text-slate-900 tracking-tight">
                      {activity.timeStart} — {activity.timeEnd}
                    </span>
                    {getStatusBadge(activity.status)}
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                        {activity.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{activity.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub details footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  {activity.status === 'Hoàn tất' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  {activity.status === 'Cần xử lý' && (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  {activity.status === 'Đang diễn ra' && (
                    <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0 animate-ping"></span>
                  )}
                  <span className="truncate">{activity.details}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Notes Bar */}
      <div className="px-5 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <Pin className="w-3.5 h-3.5 text-amber-500 rotate-45 shrink-0" />
          <span className="font-semibold text-slate-800">
            Ghi chú điều phối:
          </span>
          <span className="text-slate-600">
            {currentDay.dispatcherNote || 'Theo dõi tình hình thời tiết và liên lạc với tài xế mỗi 2 giờ.'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-semibold shrink-0">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            5/5 dịch vụ xác nhận
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            1 việc cần duyệt
          </span>
        </div>
      </div>
    </div>
  );
};
