import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Edit2,
  Trash2,
  Menu,
  AlertTriangle,
} from 'lucide-react';
import { TripData, Activity } from '../../types/travel';
import { Modal } from '../common/Modal';

type AppRole = 'user' | 'admin';

interface HeaderProps {
  trip: TripData | null;
  role: AppRole;
  onOpenEditTripModal?: () => void;
  onDeleteCurrentTrip?: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onSelectActivity?: (activity: Activity, dayIndex: number) => void;
  onSelectLocation?: (locationName: string) => void;
  onSelectMember?: (memberId: string) => void;
  onToggleAttendance?: (memberId: string) => void;
  onOpenMobileMenu?: () => void;
  isTripParticipant?: boolean;
  currentUserUid?: string;
}

export const Header: React.FC<HeaderProps> = ({
  trip,
  role,
  onOpenEditTripModal,
  onDeleteCurrentTrip,
  onSearchChange,
  searchQuery,
  onSelectActivity,
  onSelectLocation,
  onSelectMember,
  onToggleAttendance,
  onOpenMobileMenu,
  isTripParticipant = false,
  currentUserUid,
}) => {
  const isAdminMode = role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setIsDeleteConfirmOpen(false);
  }, [trip?.id]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      }
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // 1. Matching activities across all days
  const matchingActivities: { activity: Activity; dayIndex: number; dayName: string }[] = [];
  if (normalizedQuery && trip) {
    trip.days.forEach((day) => {
      day.activities.forEach((activity) => {
        const matchesTitle = activity.title.toLowerCase().includes(normalizedQuery);
        const matchesLoc = activity.location.toLowerCase().includes(normalizedQuery);
        const matchesDetails = activity.details?.toLowerCase().includes(normalizedQuery);
        const matchesStatus = activity.status.toLowerCase().includes(normalizedQuery);
        if (matchesTitle || matchesLoc || matchesDetails || matchesStatus) {
          matchingActivities.push({ activity, dayIndex: day.dayIndex, dayName: day.dayName });
        }
      });
    });
  }

  // 2. Matching unique locations / waypoints
  const matchingLocations: { name: string; type: 'waypoint' | 'activity'; subtext?: string }[] = [];
  if (normalizedQuery && trip) {
    const seenLocations = new Set<string>();
    trip.waypoints.forEach((wp) => {
      if (wp.name.toLowerCase().includes(normalizedQuery) || wp.code.toLowerCase().includes(normalizedQuery)) {
        seenLocations.add(wp.name.toLowerCase());
        matchingLocations.push({
          name: wp.name,
          type: 'waypoint',
          subtext: `Điểm dừng #${wp.code} trên lộ trình (${wp.status})`,
        });
      }
    });
    trip.days.forEach((day) => {
      day.activities.forEach((act) => {
        if (act.location.toLowerCase().includes(normalizedQuery) && !seenLocations.has(act.location.toLowerCase())) {
          seenLocations.add(act.location.toLowerCase());
          matchingLocations.push({
            name: act.location,
            type: 'activity',
            subtext: `Địa điểm trong Ngày ${day.dayIndex} (${act.title})`,
          });
        }
      });
    });
  }

  // 3. Matching members
  const matchingMembers = normalizedQuery && trip
    ? trip.members.filter(
        (m) =>
          m.name.toLowerCase().includes(normalizedQuery) ||
          m.role.toLowerCase().includes(normalizedQuery) ||
          m.phone.toLowerCase().includes(normalizedQuery) ||
          (m.specialPreference && m.specialPreference.toLowerCase().includes(normalizedQuery)),
      )
    : [];

  const totalResults = matchingActivities.length + matchingLocations.length + matchingMembers.length;

  return (
    <header
      className={`px-4 py-3 sm:px-6 lg:sticky lg:top-0 z-30 transition-colors ${
        isAdminMode
          ? 'bg-slate-900 border-b border-slate-800 text-slate-200'
          : 'bg-white border-b border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Mobile Menu + Clean Title & Unboxed Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Mở menu điều hướng"
              className={`lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border transition shrink-0 ${
                isAdminMode
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className={`text-base sm:text-xl font-bold tracking-tight truncate ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                {trip ? trip.title : 'Không gian làm việc Voyager'}
              </h1>

              {trip && (onOpenEditTripModal || onDeleteCurrentTrip) && (
                <div className="flex items-center gap-1 shrink-0">
                  {onOpenEditTripModal && (
                    <button
                      type="button"
                      onClick={onOpenEditTripModal}
                      title="Chỉnh sửa thông tin chuyến đi"
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        isAdminMode
                          ? 'text-slate-400 hover:text-teal-300 hover:bg-slate-800'
                          : 'text-slate-400 hover:text-teal-700 hover:bg-slate-100'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeleteCurrentTrip && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      title="Xóa chuyến đi hiện tại"
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        isAdminMode
                          ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {trip ? (
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5 ${isAdminMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className={`font-mono font-semibold ${isAdminMode ? 'text-teal-300' : 'text-slate-700'}`}>
                  {trip.code}
                </span>
                <span aria-hidden="true">·</span>
                <span className={trip.status === 'Đang vận hành' ? (isAdminMode ? 'text-emerald-400 font-medium' : 'text-emerald-700 font-medium') : ''}>
                  {trip.status}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Ngày {trip.currentDay}/{trip.totalDays}
                </span>
                {isTripParticipant && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-indigo-600">Chế độ Hành khách (Chỉ xem)</span>
                  </>
                )}
              </div>
            ) : (
              <p className={`text-xs mt-0.5 ${isAdminMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Chọn hoặc tạo chuyến đi để bắt đầu
              </p>
            )}
          </div>
        </div>

        {/* Right: Clean Global Search */}
        <div ref={containerRef} className="relative w-full md:w-72 lg:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsDropdownOpen(true);
            }}
            placeholder="Tìm hoạt động, địa điểm, thành viên..."
            className={`w-full pl-9 pr-12 py-2 text-xs rounded-lg transition ${
              isAdminMode
                ? 'bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:border-teal-500'
                : 'bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 border border-slate-200 focus:outline-none focus:border-teal-600'
            }`}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setIsDropdownOpen(false);
              }}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-1 py-0.5 rounded text-xs transition ${
                isAdminMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          ) : (
            <kbd
              className={`hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                isAdminMode
                  ? 'bg-slate-900 border border-slate-700 text-slate-400'
                  : 'bg-white border border-slate-200 text-slate-400'
              }`}
            >
              ⌘K
            </kbd>
          )}

          {/* Instant Search Results Dropdown */}
          {isDropdownOpen && normalizedQuery && (
            <div
              className={`absolute right-0 left-0 mt-2 rounded-xl overflow-hidden z-50 text-xs max-h-[420px] overflow-y-auto ${
                isAdminMode
                  ? 'bg-slate-900 border border-slate-700 shadow-2xl text-slate-200 divide-y divide-slate-800'
                  : 'bg-white shadow-xl border border-slate-200 text-slate-800 divide-y divide-slate-100'
              }`}
            >
              <div
                className={`px-3 py-2.5 border-b flex items-center justify-between ${
                  isAdminMode ? 'bg-slate-800/80 border-slate-700/70 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}
              >
                <span className="font-semibold">Kết quả tìm kiếm ({totalResults})</span>
                <span className="text-[11px] text-slate-400">ESC để đóng</span>
              </div>

              {totalResults === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  Không tìm thấy dữ liệu khớp với &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div>
                  {matchingActivities.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-teal-600" />
                        <span>Hoạt động ({matchingActivities.length})</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {matchingActivities.slice(0, 5).map(({ activity, dayIndex }) => (
                          <div
                            key={activity.id}
                            onClick={() => {
                              onSelectActivity?.(activity, dayIndex);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 ${
                              isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                                {activity.title}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 tabular-nums">
                                <span className="font-medium text-teal-700">Ngày {dayIndex}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{activity.timeStart}–{activity.timeEnd}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{activity.location}</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-500 shrink-0">{activity.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingLocations.length > 0 && (
                    <div className="p-2 border-t border-slate-100">
                      <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-sky-500" />
                        <span>Địa điểm ({matchingLocations.length})</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {matchingLocations.slice(0, 4).map((loc, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              onSelectLocation?.(loc.name);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 ${
                              isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                                {loc.name}
                              </div>
                              {loc.subtext && (
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">{loc.subtext}</div>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-teal-700 shrink-0">Bản đồ →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingMembers.length > 0 && (
                    <div className="p-2 border-t border-slate-100">
                      <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-emerald-500" />
                        <span>Thành viên ({matchingMembers.length})</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {matchingMembers.slice(0, 4).map((m) => {
                          const canToggleMember =
                            !isTripParticipant ||
                            Boolean(currentUserUid && (m.uid === currentUserUid || m.invitedByUid === currentUserUid));
                          return (
                            <div
                              key={m.id}
                              className={`p-2 rounded-lg transition flex items-center justify-between gap-2 ${
                                isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  onSelectMember?.(m.id);
                                  setIsDropdownOpen(false);
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center shrink-0 text-xs">
                                  {m.avatar}
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
                                    {m.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {m.role}{m.phone ? ` · ${m.phone}` : ''}
                                  </div>
                                </div>
                              </div>

                              {canToggleMember && onToggleAttendance ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleAttendance(m.id)}
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition shrink-0 ${
                                    m.attendanceStatus === 'Có mặt'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{m.attendanceStatus || 'Điểm danh'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500 shrink-0">
                                  {m.attendanceStatus || 'Chưa điểm danh'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {trip && onDeleteCurrentTrip && (
        <Modal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          maxWidth="sm"
          hideHeader
        >
          <div className="p-6 text-xs text-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Xác nhận xóa chuyến đi?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa chuyến đi <strong>&quot;{trip.title}&quot;</strong> ({trip.code})? Hành động này sẽ xóa toàn bộ lịch trình, thành viên và ngân sách của chuyến đi và không thể hoàn tác.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  onDeleteCurrentTrip();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
};
