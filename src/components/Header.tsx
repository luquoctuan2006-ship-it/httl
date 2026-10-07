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
  Database
} from 'lucide-react';
import { TripData, Activity, TripMember } from '../types/travel';

type AppRole = 'user' | 'admin';

interface HeaderProps {
  trip: TripData;
  role: AppRole;
  onOpenCreateTripModal: () => void;
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
    <header className="bg-white border-b border-slate-200/90 px-6 py-4 sticky top-0 z-30">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Breadcrumbs & Title */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>{isAdminMode ? 'ADMIN OPS' : 'USER PORTAL'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-teal-700 font-bold">{trip.code}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {trip.title}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {trip.status}
            </span>

            {/* Firestore live indicator */}
            <span
              title="Đồng bộ Firestore thời gian thực"
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                firebaseStatus === 'connected'
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
              className="w-full pl-9 pr-14 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setIsDropdownOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-slate-200 text-slate-400 font-mono px-1.5 py-0.5 rounded shadow-xs">
                ⌘K
              </kbd>
            )}

            {/* Instant Search Results Dropdown */}
            {isDropdownOpen && normalizedQuery && (
              <div className="absolute right-0 left-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[460px] overflow-y-auto">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    Kết quả tìm kiếm ({totalResults})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Nhấn ESC để đóng
                  </span>
                </div>

                {totalResults === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    Không tìm thấy hoạt động, địa điểm hay thành viên nào khớp với &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {/* Category: Hoạt động */}
                    {matchingActivities.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-teal-600" />
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
                              className="p-2 rounded-xl hover:bg-teal-50/70 cursor-pointer transition flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 truncate">
                                  {activity.title}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                    {dayName} (Ngày {dayIndex})
                                  </span>
                                  <span>{activity.timeStart} — {activity.timeEnd}</span>
                                  <span className="truncate">{activity.location}</span>
                                </div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 shrink-0">
                                {activity.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: Địa điểm */}
                    {matchingLocations.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-blue-600" />
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
                              className="p-2 rounded-xl hover:bg-blue-50/70 cursor-pointer transition flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{loc.name}</span>
                                </div>
                                {loc.subtext && (
                                  <div className="text-[11px] text-slate-400 mt-0.5 truncate pl-4.5">
                                    {loc.subtext}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-blue-600 font-bold shrink-0">
                                Xem bản đồ →
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: Thành viên */}
                    {matchingMembers.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-emerald-600" />
                          <span>Thành viên đoàn ({matchingMembers.length})</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {matchingMembers.slice(0, 4).map((m) => (
                            <div
                              key={m.id}
                              className="p-2 rounded-xl hover:bg-emerald-50/60 transition flex items-center justify-between gap-2"
                            >
                              <div
                                onClick={() => {
                                  onSelectMember?.(m.id);
                                  setIsDropdownOpen(false);
                                }}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                  {m.avatar}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 truncate">
                                    {m.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {m.role} • {m.phone}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onToggleAttendance?.(m.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0 ${
                                  m.attendanceStatus === 'Có mặt'
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
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
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-teal-700/20 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdminMode ? 'Tạo tour (AI)' : 'Tạo chuyến đi'}</span>
          </button>

        </div>
      </div>
    </header>
  );
};
