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
  searchQuery?: string;
  onClearSearch?: () => void;
  onUpdateStatus?: (id: string, newStatus: Activity['status']) => void;
  onDeleteActivity?: (id: string) => void;
  onEditActivity?: (activity: Activity) => void;
  onAddDay?: () => void;
  onDeleteDay?: (dayIndex: number) => void;
  onUpdateDayNote?: (dayIndex: number, note: string) => void;
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
  searchQuery = '',
  onClearSearch,
  onUpdateStatus,
  onDeleteActivity,
  onEditActivity,
  onAddDay,
  onDeleteDay,
  onUpdateDayNote,
}) => {
  const currentDay = days.find((d) => d.dayIndex === currentDayIndex) || days[0] || {
    dayIndex: 1,
    fullDate: 'Ngày 1',
    dayName: 'T2',
    dateNum: 1,
    activities: [],
    dispatcherNote: '',
  };
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const [currentTimeStr, setCurrentTimeStr] = React.useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [hours, mins] = currentTimeStr.split(':').map(Number);
  const totalMins = (hours || 0) * 60 + (mins || 0);
  const timelinePercent = Math.max(8, Math.min(92, ((totalMins - 360) / (1320 - 360)) * 100));

  // Current day activities matching search
  const filteredActivities = (currentDay.activities || []).filter((activity) => {
    if (!normalizedQuery) return true;
    return (
      activity.title.toLowerCase().includes(normalizedQuery) ||
      activity.location.toLowerCase().includes(normalizedQuery) ||
      (activity.details && activity.details.toLowerCase().includes(normalizedQuery)) ||
      activity.status.toLowerCase().includes(normalizedQuery) ||
      activity.type.toLowerCase().includes(normalizedQuery)
    );
  });

  const confirmedCount = (currentDay.activities || []).filter(
    (a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất'
  ).length;
  const pendingCount = (currentDay.activities || []).filter(
    (a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra'
  ).length;

  const totalTripActivities = days.reduce((sum, d) => sum + (d.activities?.length || 0), 0);
  const totalTripConfirmed = days.reduce(
    (sum, d) => sum + (d.activities?.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length || 0),
    0
  );

  const otherDaysWithMatches = normalizedQuery
    ? days.filter(
        (d) =>
          d.dayIndex !== currentDay.dayIndex &&
          d.activities.some(
            (a) =>
              a.title.toLowerCase().includes(normalizedQuery) ||
              a.location.toLowerCase().includes(normalizedQuery) ||
              (a.details && a.details.toLowerCase().includes(normalizedQuery))
          )
      )
    : [];

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
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl gap-1 overflow-x-auto max-w-full">
            {days.map((day) => {
              const isActive = day.dayIndex === currentDayIndex;
              const label = day.dayName ? `${day.dayName} ${day.dateNum ?? ''}`.trim() : (day.dateLabel || `Ngày ${day.dayIndex}`);
              return (
                <button
                  key={day.dayIndex}
                  onClick={() => onSelectDay(day.dayIndex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{label}</span>
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

            {onAddDay && (
              <button
                type="button"
                onClick={onAddDay}
                title="Thêm ngày mới vào lịch trình"
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 hover:bg-teal-100/80 hover:text-teal-900 transition shrink-0 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm ngày</span>
              </button>
            )}
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

      {/* Search Filter Banner */}
      {normalizedQuery && (
        <div className="px-5 py-2.5 bg-amber-50/90 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <span className="font-bold">Lọc theo: &quot;{searchQuery}&quot;</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[11px]">
              {filteredActivities.length} kết quả
            </span>
          </div>

          <div className="flex items-center gap-2">
            {otherDaysWithMatches.length > 0 && (
              <span className="text-amber-800 text-[11px]">
                Có kết quả ở ngày khác: {otherDaysWithMatches.map((d) => (
                  <button
                    key={d.dayIndex}
                    type="button"
                    onClick={() => onSelectDay(d.dayIndex)}
                    className="ml-1 px-1.5 py-0.5 rounded bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-100"
                  >
                    {d.dayName}
                  </button>
                ))}
              </span>
            )}
            {onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="text-amber-900 hover:underline font-bold text-[11px]"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline Current Indicator Bar */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-4 text-xs font-semibold text-slate-400">
        <span className="font-mono text-slate-500 font-bold shrink-0">06:00</span>
        
        <div className="flex-1 relative flex items-center">
          <div className="w-full h-0.5 bg-slate-200 rounded-full"></div>
          {/* Current time marker badge */}
          <div
            className="absolute px-3 py-1 bg-[#0F766E] text-white rounded-full text-[11px] font-black tracking-wide shadow-md flex items-center gap-1.5 transition-all"
            style={{ left: `${timelinePercent}%`, transform: 'translateX(-50%)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping"></span>
            <span>{currentTimeStr} HIỆN TẠI</span>
          </div>
        </div>

        <span className="font-mono text-slate-500 font-bold shrink-0">22:00</span>
      </div>

      {/* Activity Content: 'all' mode vs 'timeline' mode */}
      {filterMode === 'all' ? (
        <div className="p-4 sm:p-5 space-y-5 max-h-[650px] overflow-y-auto">
          {days.map((day) => {
            const dayActs = (day.activities || []).filter((activity) => {
              if (!normalizedQuery) return true;
              return (
                activity.title.toLowerCase().includes(normalizedQuery) ||
                activity.location.toLowerCase().includes(normalizedQuery) ||
                (activity.details && activity.details.toLowerCase().includes(normalizedQuery)) ||
                activity.status.toLowerCase().includes(normalizedQuery) ||
                activity.type.toLowerCase().includes(normalizedQuery)
              );
            });
            const isSelectedDay = day.dayIndex === currentDayIndex;

            return (
              <div
                key={day.dayIndex}
                className={`rounded-2xl border p-4 transition ${
                  isSelectedDay
                    ? 'border-teal-400 bg-teal-50/30 ring-2 ring-teal-500/10'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-black">
                      Ngày {day.dayIndex} ({day.dayName} {day.dateNum})
                    </span>
                    <h3 className="text-xs font-extrabold text-slate-900">{day.fullDate}</h3>
                    {day.dispatcherNote && (
                      <span className="text-[11px] text-slate-500 hidden md:inline truncate max-w-md">
                        • {day.dispatcherNote}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">
                      {dayActs.length} hoạt động
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.dayIndex)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        isSelectedDay
                          ? 'bg-teal-700 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelectedDay ? 'Đang chọn' : 'Xem chặng này'}
                    </button>
                  </div>
                </div>

                {dayActs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">Chưa có hoạt động nào trong ngày này.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dayActs.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => onSelectActivity(activity)}
                        className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono font-extrabold text-slate-800">
                              {activity.timeStart} — {activity.timeEnd}
                            </span>
                            {getStatusBadge(activity.status)}
                          </div>
                          <div className="flex items-start gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{activity.title}</h4>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{activity.location}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate max-w-[120px]">{activity.details || activity.type}</span>
                          {activity.cost !== undefined && activity.cost > 0 && (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                              {activity.cost.toLocaleString('vi-VN')} ₫
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Timeline horizontal cards row */
        <div className="p-4 sm:p-5 overflow-x-auto scrollbar-thin">
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
              {normalizedQuery ? (
                <>
                  <p>Không tìm thấy hoạt động nào phù hợp với từ khóa &quot;{searchQuery}&quot; trong ngày này.</p>
                  {onClearSearch && (
                    <button
                      type="button"
                      onClick={onClearSearch}
                      className="inline-block mt-2 text-teal-600 font-bold hover:underline"
                    >
                      Xem tất cả hoạt động
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-500 font-medium">Chưa có hoạt động nào được tạo trong Ngày {currentDay.dayIndex}.</p>
                  <div className="flex items-center justify-center gap-2">
                    {canAddActivity && (
                      <button
                        type="button"
                        onClick={onAddActivity}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm hoạt động đầu tiên</span>
                      </button>
                    )}
                    {onDeleteDay && days.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteDay(currentDay.dayIndex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                      >
                        <span>Xóa ngày trống này</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-4 min-w-[980px] pb-1">
              {filteredActivities.map((activity) => {
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
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
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

                    {activity.cost !== undefined && activity.cost > 0 && (
                      <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        {(activity.cost).toLocaleString('vi-VN')} ₫
                      </span>
                    )}
                  </div>

                  {/* Quick Status Action Bar */}
                  {onUpdateStatus && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2.5 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-1 text-[10px]"
                    >
                      <span className="text-slate-400 font-semibold">Đổi trạng thái:</span>
                      <select
                        value={activity.status}
                        onChange={(e) => onUpdateStatus(activity.id, e.target.value as Activity['status'])}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 font-bold text-slate-700 outline-none cursor-pointer transition text-[10px]"
                      >
                        <option value="Đã xác nhận">Đã xác nhận</option>
                        <option value="Đang diễn ra">Đang diễn ra</option>
                        <option value="Cần xử lý">Cần xử lý</option>
                        <option value="Hoàn tất">Hoàn tất</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

      {/* Footer Notes Bar */}
      <div className="px-5 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 max-w-full sm:max-w-xl">
          <Pin className="w-3.5 h-3.5 text-amber-500 rotate-45 shrink-0" />
          <span className="font-semibold text-slate-800 shrink-0">
            Ghi chú Ngày {currentDay.dayIndex}:
          </span>
          {onUpdateDayNote ? (
            <input
              type="text"
              defaultValue={currentDay.dispatcherNote || ''}
              key={`${currentDay.dayIndex}-${currentDay.dispatcherNote}`}
              onBlur={(e) => {
                if (e.target.value !== (currentDay.dispatcherNote || '')) {
                  onUpdateDayNote(currentDay.dayIndex, e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Nhấp để nhập ghi chú cho chặng này..."
              className="text-slate-700 bg-transparent hover:bg-white focus:bg-white px-2 py-0.5 rounded border border-transparent hover:border-slate-300 focus:border-teal-500 outline-none w-full truncate transition text-xs"
            />
          ) : (
            <span className="text-slate-600 truncate">
              {currentDay.dispatcherNote || 'Theo dõi tình hình thời tiết và liên lạc với tài xế theo lịch trình.'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-semibold shrink-0">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {confirmedCount}/{(currentDay.activities || []).length} hoạt động đã xác nhận
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {pendingCount} việc cần theo dõi
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-600 font-bold">
            Toàn tour: {totalTripConfirmed}/{totalTripActivities} hoàn tất
          </span>
        </div>
      </div>
    </div>
  );
};
