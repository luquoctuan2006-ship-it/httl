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
  Pin,
  Sparkles,
} from 'lucide-react';
import { DaySchedule, Activity } from '../../types/travel';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  sightseeing: 'Tham quan',
  meal: 'Ăn uống',
  transport: 'Di chuyển',
  hotel: 'Lưu trú',
  checkin: 'Check-in',
  briefing: 'Điều hành',
};

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
  onOpenAutoArrange?: () => void;
  onOpenAIOptimize?: () => void;
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
  onDeleteActivity: _onDeleteActivity,
  onEditActivity: _onEditActivity,
  onAddDay,
  onDeleteDay,
  onUpdateDayNote,
  onOpenAutoArrange,
  onOpenAIOptimize,
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
    (a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất',
  ).length;
  const pendingCount = (currentDay.activities || []).filter(
    (a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt',
  ).length;

  const totalTripActivities = days.reduce((sum, d) => sum + (d.activities?.length || 0), 0);
  const totalTripCompleted = days.reduce(
    (sum, d) => sum + (d.activities?.filter((a) => a.status === 'Hoàn tất').length || 0),
    0,
  );

  const otherDaysWithMatches = normalizedQuery
    ? days.filter(
        (d) =>
          d.dayIndex !== currentDay.dayIndex &&
          d.activities.some(
            (a) =>
              a.title.toLowerCase().includes(normalizedQuery) ||
              a.location.toLowerCase().includes(normalizedQuery) ||
              (a.details && a.details.toLowerCase().includes(normalizedQuery)),
          ),
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

  const getStatusClass = (status: Activity['status']) => {
    switch (status) {
      case 'Hoàn tất':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Đang diễn ra':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'Cần xử lý':
      case 'Chờ duyệt':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'Đã xác nhận':
        return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const renderActivityRow = (activity: Activity) => {
    const isOngoing = activity.status === 'Đang diễn ra';
    return (
      <div
        key={activity.id}
        onClick={() => onSelectActivity(activity)}
        className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition ${
          isOngoing ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0 pt-0.5 w-24">
            {activity.timeStart}–{activity.timeEnd}
          </div>

          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
            {getActivityIcon(activity.type)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                {activity.title}
              </h4>
              <span className="text-[11px] text-slate-400">
                {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
              {activity.location && (
                <span className="inline-flex items-center gap-1 truncate max-w-xs">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{activity.location}</span>
                </span>
              )}
              {activity.details && (
                <span className="text-slate-400 truncate max-w-md">{activity.details}</span>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-0 sm:pl-3"
          onClick={(e) => (onUpdateStatus ? e.stopPropagation() : undefined)}
        >
          {canAddActivity && activity.cost !== undefined && activity.cost > 0 && (
            <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
              {activity.cost.toLocaleString('vi-VN')} ₫
            </span>
          )}

          {onUpdateStatus ? (
            <select
              aria-label={`Trạng thái hoạt động ${activity.title}`}
              value={activity.status}
              onChange={(e) => onUpdateStatus(activity.id, e.target.value as Activity['status'])}
              className={`border rounded-lg px-2.5 py-1 font-semibold outline-none cursor-pointer transition text-xs ${getStatusClass(activity.status)}`}
            >
              <option value="Đã xác nhận">Đã xác nhận</option>
              <option value="Đang diễn ra">Đang diễn ra</option>
              <option value="Cần xử lý">Cần xử lý</option>
              <option value="Hoàn tất">Hoàn tất</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
            </select>
          ) : (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${getStatusClass(activity.status)}`}>
              {activity.status}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col w-full max-w-full min-w-0">
      {/* Unified Header Toolbar */}
      <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
              Lịch trình chuyến đi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {filterMode === 'all'
                ? `${days.length} ngày · ${totalTripCompleted}/${totalTripActivities} hoàn tất`
                : `Ngày ${currentDay.dayIndex} (${currentDay.fullDate}) · ${confirmedCount}/${(currentDay.activities || []).length} đã xác nhận`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => filterMode !== 'timeline' && onToggleFilterMode()}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                filterMode === 'timeline' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo ngày
            </button>
            <button
              type="button"
              onClick={() => filterMode !== 'all' && onToggleFilterMode()}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ngày
            </button>
          </div>

          {onOpenAutoArrange && (
            <button
              type="button"
              onClick={onOpenAutoArrange}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Loại bỏ chồng chéo giờ và cân bằng thời gian di chuyển"
            >
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Xếp lịch</span>
            </button>
          )}

          {onOpenAIOptimize && (
            <button
              type="button"
              onClick={onOpenAIOptimize}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Tối ưu</span>
            </button>
          )}

          {canAddActivity && (
            <button
              type="button"
              onClick={onAddActivity}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm hoạt động</span>
            </button>
          )}
        </div>
      </div>

      {/* Day Switcher Strip (in single-day mode) */}
      {filterMode === 'timeline' && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
          {days.map((day) => {
            const isActive = day.dayIndex === currentDayIndex;
            const label = `Ngày ${day.dayIndex}${day.dayName ? ` (${day.dayName})` : ''}`;
            return (
              <button
                key={day.dayIndex}
                type="button"
                onClick={() => onSelectDay(day.dayIndex)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{label}</span>
                {day.hasWarning && !isActive && (
                  <span className="ml-1.5 text-amber-600" title="Có cảnh báo">•</span>
                )}
              </button>
            );
          })}

          {onAddDay && (
            <button
              type="button"
              onClick={onAddDay}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 transition shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm ngày</span>
            </button>
          )}
        </div>
      )}

      {/* Search Filter Notice */}
      {normalizedQuery && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span>Đang lọc theo <strong>&quot;{searchQuery}&quot;</strong> · {filteredActivities.length} kết quả</span>
            {otherDaysWithMatches.length > 0 && (
              <span className="text-amber-800">
                (Ngày khác:{' '}
                {otherDaysWithMatches.map((d, i) => (
                  <React.Fragment key={d.dayIndex}>
                    {i > 0 ? ', ' : ''}
                    <button
                      type="button"
                      onClick={() => onSelectDay(d.dayIndex)}
                      className="font-semibold underline hover:text-amber-950"
                    >
                      Ngày {d.dayIndex}
                    </button>
                  </React.Fragment>
                ))}
                )
              </span>
            )}
          </div>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="font-semibold text-amber-900 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {filterMode === 'all' ? (
        <div className="divide-y divide-slate-200 max-h-[720px] overflow-y-auto">
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
              <div key={day.dayIndex}>
                <div className="px-4 sm:px-5 py-3 bg-slate-50 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-700">Ngày {day.dayIndex}</span>
                    <span className="text-xs font-semibold text-slate-900">{day.fullDate}</span>
                    {day.dispatcherNote && (
                      <span className="text-xs text-slate-500 hidden md:inline truncate max-w-md">
                        · {day.dispatcherNote}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 tabular-nums">{dayActs.length} hoạt động</span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDay(day.dayIndex);
                        onToggleFilterMode();
                      }}
                      className={`font-semibold cursor-pointer ${
                        isSelectedDay ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'
                      }`}
                    >
                      Mở chi tiết ngày →
                    </button>
                  </div>
                </div>

                {dayActs.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-slate-400">Chưa có hoạt động nào trong ngày này.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dayActs.map(renderActivityRow)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 space-y-3">
          {normalizedQuery ? (
            <>
              <p>Không tìm thấy hoạt động nào khớp với &quot;{searchQuery}&quot; trong Ngày {currentDay.dayIndex}.</p>
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="text-teal-700 font-semibold hover:underline"
                >
                  Xem tất cả hoạt động
                </button>
              )}
            </>
          ) : (
            <>
              <p>Chưa có hoạt động nào trong Ngày {currentDay.dayIndex}.</p>
              <div className="flex items-center justify-center gap-2">
                {canAddActivity && (
                  <button
                    type="button"
                    onClick={onAddActivity}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm hoạt động đầu tiên</span>
                  </button>
                )}
                {onDeleteDay && days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteDay(currentDay.dayIndex)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Xóa ngày trống</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredActivities.map(renderActivityRow)}
        </div>
      )}

      {/* Footer Note */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 flex-1 min-w-0">
          <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
              placeholder="Nhấp để nhập ghi chú cho ngày này..."
              className="text-slate-700 bg-transparent hover:bg-white focus:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-teal-600 outline-none w-full truncate transition text-xs"
            />
          ) : (
            <span className="text-slate-600 truncate">
              {currentDay.dispatcherNote || 'Theo dõi lịch trình và giữ liên lạc với trưởng đoàn.'}
            </span>
          )}
        </div>

        <div className="text-slate-500 shrink-0 tabular-nums">
          {pendingCount > 0 ? `${pendingCount} mục cần theo dõi · ` : ''}
          Toàn chuyến: {totalTripCompleted}/{totalTripActivities} hoàn tất
        </div>
      </div>
    </div>
  );
};
