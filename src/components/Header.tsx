import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  ChevronRight,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Check,
  X,
  Database,
  Edit2,
  Trash2,
} from 'lucide-react';
import { TripData, Activity, TripMember } from '../types/travel';

type AppRole = 'user' | 'admin';

interface HeaderProps {
  trip: TripData;
  role: AppRole;
  onOpenCreateTripModal: () => void;
  onOpenEditTripModal?: () => void;
  onDeleteCurrentTrip?: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onSelectActivity?: (activity: Activity, dayIndex: number) => void;
  onSelectLocation?: (locationName: string) => void;
  onSelectMember?: (memberId: string) => void;
  onToggleAttendance?: (memberId: string) => void;
  firebaseStatus?: 'loading' | 'connected' | 'error';
}

export const Header: React.FC<HeaderProps> = ({
  trip,
  role,
  onOpenCreateTripModal,
  onOpenEditTripModal,
  onDeleteCurrentTrip,
  onSearchChange,
  searchQuery,
  onSelectActivity,
  onSelectLocation,
  onSelectMember,
  onToggleAttendance,
  firebaseStatus = 'connected',
}) => {
  const isAdminMode = role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
  if (normalizedQuery) {
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
  if (normalizedQuery) {
    const seenLocations = new Set<string>();
    // Check waypoints
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
    // Check activity locations
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
  const matchingMembers = normalizedQuery
    ? trip.members.filter(
        (m) =>
          m.name.toLowerCase().includes(normalizedQuery) ||
          m.role.toLowerCase().includes(normalizedQuery) ||
          m.phone.toLowerCase().includes(normalizedQuery) ||
          (m.specialPreference && m.specialPreference.toLowerCase().includes(normalizedQuery))
      )
    : [];

  const totalResults = matchingActivities.length + matchingLocations.length + matchingMembers.length;

  return (
    <header
      className={`px-6 py-4 sticky top-0 z-30 transition-colors backdrop-blur-md ${
        isAdminMode
          ? 'bg-slate-900/95 border-b border-slate-800 text-slate-200 shadow-md shadow-slate-950/40'
          : 'bg-white/95 border-b border-slate-200/90 text-slate-800'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Breadcrumbs & Title */}
        <div>
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1 ${
              isAdminMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <span className={isAdminMode ? 'text-teal-400 font-bold' : ''}>{isAdminMode ? 'ADMIN OPS' : 'USER PORTAL'}</span>
            <ChevronRight className={`w-3.5 h-3.5 ${isAdminMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <span className={isAdminMode ? 'text-teal-300 font-bold font-mono' : 'text-teal-700 font-bold'}>{trip.code}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={`text-2xl font-black tracking-tight ${isAdminMode ? 'text-white' : 'text-slate-900'}`}>
              {trip.title}
            </h1>

            {/* Quick Actions: Sửa & Xóa chuyến đi */}
            <div className="flex items-center gap-1">
              {onOpenEditTripModal && (
                <button
                  type="button"
                  onClick={onOpenEditTripModal}
                  title="Chỉnh sửa thông tin chuyến đi (tên, mã tour, thời gian, ngân sách)"
                  className={`p-1.5 rounded-xl border transition ${
                    isAdminMode
                      ? 'text-slate-400 hover:text-teal-300 hover:bg-slate-800 border-slate-700'
                      : 'text-slate-500 hover:text-teal-700 hover:bg-teal-50 border-slate-200'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeleteCurrentTrip && (
                <button
                  type="button"
                  onClick={onDeleteCurrentTrip}
                  title="Xóa chuyến đi hiện tại"
                  className={`p-1.5 rounded-xl border transition ${
                    isAdminMode
                      ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800 border-slate-700'
                      : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isAdminMode
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {trip.status}
            </span>

            {/* Firestore live indicator */}
            <span
              title="Đồng bộ Firestore thời gian thực"
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                isAdminMode
                  ? firebaseStatus === 'connected'
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                    : firebaseStatus === 'loading'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : firebaseStatus === 'connected'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : firebaseStatus === 'loading'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>
                {firebaseStatus === 'connected' && 'Firestore trực tiếp'}
                {firebaseStatus === 'loading' && 'Đang đồng bộ...'}
                {firebaseStatus === 'error' && 'Lỗi kết nối'}
              </span>
            </span>
          </div>
        </div>

        {/* Right: Search, Notifications & Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Global Search Bar with Live Instant Dropdown */}
          <div ref={containerRef} className="relative w-72 md:w-80">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsDropdownOpen(true);
              }}
              placeholder="Tìm hoạt động, địa điểm, thành viên... ⌘K"
              className={`w-full pl-9 pr-14 py-2 text-xs rounded-xl transition ${
                isAdminMode
                  ? 'bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 shadow-inner'
                  : 'bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs'
              }`}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setIsDropdownOpen(false);
                }}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition ${
                  isAdminMode
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                }`}
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            ) : (
              <kbd
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isAdminMode
                    ? 'bg-slate-800 border border-slate-700 text-slate-400 shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-400 shadow-xs'
                }`}
              >
                ⌘K
              </kbd>
            )}

            {/* Instant Search Results Dropdown */}
            {isDropdownOpen && normalizedQuery && (
              <div
                className={`absolute right-0 left-0 mt-2 rounded-2xl overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[460px] overflow-y-auto ${
                  isAdminMode
                    ? 'bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-200 divide-y divide-slate-800'
                    : 'bg-white rounded-2xl shadow-xl border border-slate-200 text-slate-800 divide-y divide-slate-100'
                }`}
              >
                <div
                  className={`p-3 border-b flex items-center justify-between ${
                    isAdminMode ? 'bg-slate-800/80 border-slate-700/70 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                  }`}
                >
                  <span className="font-bold">
                    Kết quả tìm kiếm ({totalResults})
                  </span>
                  <span className={`text-[11px] ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    Nhấn ESC để đóng
                  </span>
                </div>

                {totalResults === 0 ? (
                  <div className={`p-6 text-center ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    Không tìm thấy hoạt động, địa điểm hay thành viên nào khớp với &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div>
                    {/* Category: Hoạt động */}
                    {matchingActivities.length > 0 && (
                      <div className="p-2">
                        <div
                          className={`px-2 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            isAdminMode ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <Calendar className="w-3 h-3 text-teal-500" />
                          <span>Hoạt động ({matchingActivities.length})</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {matchingActivities.slice(0, 5).map(({ activity, dayIndex, dayName }) => (
                            <div
                              key={activity.id}
                              onClick={() => {
                                onSelectActivity?.(activity, dayIndex);
                                setIsDropdownOpen(false);
                              }}
                              className={`p-2 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                                isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-teal-50/70'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className={`font-bold truncate ${isAdminMode ? 'text-white' : 'text-slate-800'}`}>
                                  {activity.title}
                                </div>
                                <div className={`text-[11px] flex items-center gap-2 mt-0.5 ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                  <span
                                    className={`font-semibold px-1.5 py-0.2 rounded border ${
                                      isAdminMode
                                        ? 'bg-teal-950/80 text-teal-300 border-teal-800'
                                        : 'text-teal-700 bg-teal-50 border-teal-200'
                                    }`}
                                  >
                                    {dayName} (Ngày {dayIndex})
                                  </span>
                                  <span>{activity.timeStart} — {activity.timeEnd}</span>
                                  <span className="truncate">{activity.location}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                  isAdminMode
                                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {activity.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: Địa điểm */}
                    {matchingLocations.length > 0 && (
                      <div className="p-2 border-t border-slate-800/60">
                        <div
                          className={`px-2 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            isAdminMode ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-sky-400" />
                          <span>Địa điểm & Điểm dừng ({matchingLocations.length})</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {matchingLocations.slice(0, 4).map((loc, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                onSelectLocation?.(loc.name);
                                setIsDropdownOpen(false);
                              }}
                              className={`p-2 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                                isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-blue-50/70'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className={`font-bold flex items-center gap-1.5 ${isAdminMode ? 'text-white' : 'text-slate-800'}`}>
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{loc.name}</span>
                                </div>
                                {loc.subtext && (
                                  <div className={`text-[11px] mt-0.5 truncate pl-4.5 ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                    {loc.subtext}
                                  </div>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold shrink-0 ${isAdminMode ? 'text-teal-400' : 'text-blue-600'}`}>
                                Xem bản đồ →
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: Thành viên */}
                    {matchingMembers.length > 0 && (
                      <div className="p-2 border-t border-slate-800/60">
                        <div
                          className={`px-2 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            isAdminMode ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <Users className="w-3 h-3 text-emerald-400" />
                          <span>Thành viên đoàn ({matchingMembers.length})</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {matchingMembers.slice(0, 4).map((m) => (
                            <div
                              key={m.id}
                              className={`p-2 rounded-xl transition flex items-center justify-between gap-2 ${
                                isAdminMode ? 'hover:bg-slate-800/80' : 'hover:bg-emerald-50/60'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  onSelectMember?.(m.id);
                                  setIsDropdownOpen(false);
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div
                                  className={`w-7 h-7 rounded-full font-bold flex items-center justify-center shrink-0 text-xs ${
                                    isAdminMode
                                      ? 'bg-slate-800 border border-slate-700 text-teal-300'
                                      : 'bg-slate-100 border border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {m.avatar}
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-bold truncate ${isAdminMode ? 'text-white' : 'text-slate-800'}`}>
                                    {m.name}
                                  </div>
                                  <div className={`text-[11px] truncate ${isAdminMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                    {m.role} • {m.phone}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onToggleAttendance?.(m.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0 ${
                                  m.attendanceStatus === 'Có mặt'
                                    ? isAdminMode
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : isAdminMode
                                      ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-emerald-950 hover:text-emerald-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{m.attendanceStatus || 'Điểm danh'}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onOpenCreateTripModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-900/30 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdminMode ? 'Tạo tour (AI)' : 'Tạo chuyến đi'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
