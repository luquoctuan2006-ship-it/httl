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
          ? 'bg-[#090C14] border-b border-neutral-800 text-neutral-200'
          : 'bg-white border-b border-neutral-200 text-neutral-900'
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
                  ? 'border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className={`text-base sm:text-xl font-bold tracking-tight truncate ${isAdminMode ? 'text-white' : 'text-neutral-950'}`}>
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
                          ? 'text-neutral-400 hover:text-blue-400 hover:bg-neutral-800'
                          : 'text-neutral-400 hover:text-blue-600 hover:bg-blue-50'
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
                          ? 'text-neutral-400 hover:text-red-400 hover:bg-neutral-800'
                          : 'text-neutral-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {trip ? (
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5 ${isAdminMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                <span className={`font-mono font-semibold ${isAdminMode ? 'text-blue-400' : 'text-blue-700'}`}>
                  {trip.code}
                </span>
                <span aria-hidden="true">·</span>
                <span className={trip.status === 'Đang vận hành' ? (isAdminMode ? 'text-red-400 font-semibold' : 'text-red-600 font-semibold') : ''}>
                  {trip.status}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Ngày {trip.currentDay}/{trip.totalDays}
                </span>
                {isTripParticipant && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-blue-700">Chế độ Hành khách (Chỉ xem)</span>
                  </>
                )}
              </div>
            ) : (
              <p className={`text-xs mt-0.5 ${isAdminMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Chọn hoặc tạo chuyến đi để bắt đầu
              </p>
            )}
          </div>
        </div>

        {/* Right: Clean Global Search */}
        <div ref={containerRef} className="relative w-full md:w-72 lg:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
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
                ? 'bg-neutral-900 text-white placeholder-neutral-400 border border-neutral-800 focus:outline-none focus:border-blue-500'
                : 'bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white text-neutral-900 border border-neutral-200 focus:outline-none focus:border-blue-600'
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
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-neutral-400 hover:text-neutral-800'
              }`}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          ) : (
            <kbd
              className={`hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                isAdminMode
                  ? 'bg-neutral-950 border border-neutral-800 text-neutral-400'
                  : 'bg-white border border-neutral-200 text-neutral-400'
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
                  ? 'bg-neutral-950 border border-neutral-800 shadow-2xl text-neutral-200 divide-y divide-neutral-800'
                  : 'bg-white shadow-xl border border-neutral-200 text-neutral-800 divide-y divide-neutral-100'
              }`}
            >
              <div
                className={`px-3 py-2.5 border-b flex items-center justify-between ${
                  isAdminMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-100 text-neutral-700'
                }`}
              >
                <span className="font-semibold">Kết quả tìm kiếm ({totalResults})</span>
                <span className="text-[11px] text-neutral-400">ESC để đóng</span>
              </div>

              {totalResults === 0 ? (
                <div className="p-6 text-center text-neutral-400">
                  Không tìm thấy dữ liệu khớp với &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div>
                  {matchingActivities.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-blue-600" />
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
                              isAdminMode ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-neutral-950'}`}>
                                {activity.title}
                              </div>
                              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5 tabular-nums">
                                <span className="font-medium text-blue-600">Ngày {dayIndex}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{activity.timeStart}–{activity.timeEnd}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{activity.location}</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-neutral-500 shrink-0">{activity.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingLocations.length > 0 && (
                    <div className="p-2 border-t border-neutral-100">
                      <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-red-600" />
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
                              isAdminMode ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-neutral-950'}`}>
                                {loc.name}
                              </div>
                              {loc.subtext && (
                                <div className="text-[11px] text-neutral-400 truncate mt-0.5">{loc.subtext}</div>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-blue-600 shrink-0">Bản đồ →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingMembers.length > 0 && (
                    <div className="p-2 border-t border-neutral-100">
                      <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-blue-600" />
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
                                isAdminMode ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  onSelectMember?.(m.id);
                                  setIsDropdownOpen(false);
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-700 text-white font-semibold flex items-center justify-center shrink-0 text-xs">
                                  {m.avatar}
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-semibold truncate ${isAdminMode ? 'text-white' : 'text-neutral-950'}`}>
                                    {m.name}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 truncate">
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
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-neutral-100 text-neutral-700 hover:bg-blue-50 hover:text-blue-700'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{m.attendanceStatus || 'Điểm danh'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-neutral-500 shrink-0">
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
          <div className="p-6 text-xs text-neutral-800">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-950">Xác nhận xóa chuyến đi?</h3>
            <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa chuyến đi <strong>&quot;{trip.title}&quot;</strong> ({trip.code})? Hành động này sẽ xóa toàn bộ lịch trình, thành viên và ngân sách của chuyến đi và không thể hoàn tác.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  onDeleteCurrentTrip();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer"
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
