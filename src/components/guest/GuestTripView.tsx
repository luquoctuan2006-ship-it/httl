import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudSun,
  Compass,
  Copy,
  Link2,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';
import type { GuestTripData } from '../../types/travel';
import { buildRouteProgress, formatTravelDuration } from '../../utils/route/routeProgress';
import { buildGuestInviteUrl, guestTripToReadOnlyTripData, isStaffRole } from '../../utils/trip/tripJoinHelpers';
import { OfflineIndicator } from '../dashboard/OfflineIndicator';

const LiveRouteMap = lazy(() =>
  import('../dashboard/LiveRouteMap').then((m) => ({ default: m.LiveRouteMap })),
);

interface GuestTripViewProps {
  guestTrip: GuestTripData;
  guestName: string;
  joinCode: string;
  enteredFromAccount?: boolean;
  cachedAt?: string;
  onRefresh: () => Promise<void>;
  onExitGuestMode: () => void;
}

type GuestTab = 'schedule' | 'map' | 'group';

export const GuestTripView: React.FC<GuestTripViewProps> = ({
  guestTrip,
  guestName,
  joinCode,
  enteredFromAccount = false,
  cachedAt,
  onRefresh,
  onExitGuestMode,
}) => {
  const [activeTab, setActiveTab] = useState<GuestTab>('schedule');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(
    guestTrip.currentDay || guestTrip.days[0]?.dayIndex || 1,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const readOnlyTrip = useMemo(() => guestTripToReadOnlyTripData(guestTrip), [guestTrip]);
  const routeProgress = useMemo(() => buildRouteProgress(readOnlyTrip, 'all'), [readOnlyTrip]);

  const currentDay =
    guestTrip.days.find((d) => d.dayIndex === selectedDayIndex) ||
    guestTrip.days[0] ||
    null;

  const staffMembers = useMemo(
    () => guestTrip.members.filter((m) => isStaffRole(m.role)),
    [guestTrip.members],
  );
  const passengerMembers = useMemo(
    () => guestTrip.members.filter((m) => !isStaffRole(m.role)),
    [guestTrip.members],
  );

  const presentCount = guestTrip.members.filter((m) => m.attendanceStatus === 'Có mặt').length;

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopy = async (type: 'code' | 'link') => {
    const value = type === 'code' ? joinCode : buildGuestInviteUrl(joinCode);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType((prev) => (prev === type ? null : prev)), 2500);
    } catch {
      // Clipboard fallback not needed
    }
  };

  const getActivityBadge = (status: string) => {
    if (status === 'Hoàn tất') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Đang diễn ra') return 'bg-teal-50 text-teal-700 border-teal-200';
    if (status === 'Đã xác nhận') return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-10">
      {/* Top Passenger App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-700">
                <span>Hành khách (Không tài khoản)</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-700">{guestTrip.code}</span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                {guestTrip.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRefreshClick()}
              disabled={isRefreshing}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              title="Cập nhật lịch trình mới nhất từ trưởng đoàn"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Cập nhật</span>
            </button>

            <button
              type="button"
              onClick={onExitGuestMode}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{enteredFromAccount ? 'Quay lại tài khoản' : 'Thoát chuyến'}</span>
            </button>
          </div>
        </div>

        {/* Desktop Sub-Nav + Trip Quick Meta */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              {guestTrip.originFull} → {guestTrip.destinationFull}
            </span>
            {guestTrip.dates && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {guestTrip.dates}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              {guestName}
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(
              [
                { id: 'schedule', label: 'Lịch trình & Điểm dừng', icon: Calendar },
                { id: 'map', label: 'Bản đồ tuyến đường', icon: Navigation },
                { id: 'group', label: `Đoàn & Liên hệ (${guestTrip.membersTotal})`, icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        <OfflineIndicator cachedAt={cachedAt} />

        {/* Operational / Weather Alerts Notice */}
        {guestTrip.alerts.length > 0 && activeTab === 'schedule' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-amber-900 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Lưu ý mới nhất từ Ban tổ chức ({guestTrip.alerts.length})</span>
              </div>
              {guestTrip.alerts.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllAlerts((prev) => !prev)}
                  className="text-[11px] font-bold normal-case text-amber-800 hover:text-amber-950 underline"
                >
                  {showAllAlerts ? 'Thu gọn' : `Xem tất cả (${guestTrip.alerts.length})`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(showAllAlerts ? guestTrip.alerts : guestTrip.alerts.slice(0, 4)).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl bg-white border border-amber-200/80 px-3 py-2.5 text-xs"
                >
                  <div className="font-bold text-slate-900">{alert.title}</div>
                  <p className="text-slate-600 mt-0.5">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left / Top Spotlight + Vehicle Summary */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-slate-900 text-white p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-400">
                    Tiến độ hành trình
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-300 tabular-nums">
                    {routeProgress.completedStops}/{routeProgress.totalStops} điểm dừng
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold">Điểm hiện tại</div>
                    <div className="text-lg font-extrabold text-white mt-0.5">
                      {routeProgress.currentStop?.name || guestTrip.telematics.from || guestTrip.originFull}
                    </div>
                  </div>

                  {routeProgress.nextStop && (
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400 font-semibold">Điểm kế tiếp</div>
                        <div className="text-sm font-bold text-teal-300 truncate">
                          {routeProgress.nextStop.name}
                        </div>
                      </div>
                      {routeProgress.nextLegDistanceKm > 0 && (
                        <div className="text-right font-mono text-xs text-slate-300 shrink-0 tabular-nums">
                          <div>{routeProgress.nextLegDistanceKm} km</div>
                          <div className="text-[11px] text-slate-400">
                            ~{formatTravelDuration(routeProgress.nextLegMinutes)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Weather snapshot */}
                {(guestTrip.weather.temp !== 0 || guestTrip.weather.description) && (
                  <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CloudSun className="w-5 h-5 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {guestTrip.weather.description || 'Thời tiết dọc tuyến'}
                        </div>
                        {guestTrip.weather.rainProb && (
                          <div className="text-[11px] text-slate-300">
                            Khả năng mưa: {guestTrip.weather.rainProb}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-lg font-extrabold text-white tabular-nums shrink-0">
                      {guestTrip.weather.temp}°C
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle & Driver Card */}
              <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-extrabold text-slate-900">
                  <Bus className="w-4 h-4 text-teal-600" />
                  <span>Phương tiện &amp; Phụ trách xe</span>
                </div>
                <div className="space-y-2 text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Loại xe:</span>
                    <span className="font-bold text-slate-900">{guestTrip.telematics.vehicleType || guestTrip.vehicle}</span>
                  </div>
                  {guestTrip.telematics.licensePlate && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Biển số:</span>
                      <span className="font-mono font-bold text-slate-900">{guestTrip.telematics.licensePlate}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Tài xế:</span>
                    <span className="font-bold text-slate-900">{guestTrip.telematics.driver || 'Chưa phân công'}</span>
                  </div>
                  {guestTrip.telematics.driverPhone && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Liên hệ tài xế:</span>
                      <a
                        href={`tel:${guestTrip.telematics.driverPhone}`}
                        className="font-mono font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {guestTrip.telematics.driverPhone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Right: Day-by-Day Itinerary */}
            <section className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Lịch trình tham quan từng ngày
                  </h2>
                  <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
                    {guestTrip.totalDays} ngày • {guestTrip.totalActivities} hoạt động
                  </span>
                </div>

                {/* Day Selector Strip */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {guestTrip.days.map((day) => {
                    const isActive = currentDay?.dayIndex === day.dayIndex;
                    return (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => setSelectedDayIndex(day.dayIndex)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold shrink-0 border transition ${
                          isActive
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Ngày {day.dayIndex}
                        {day.dateLabel ? ` (${day.dateLabel})` : ''}
                      </button>
                    );
                  })}
                </div>

                {currentDay?.dispatcherNote && (
                  <div className="rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2.5 text-xs text-teal-900">
                    <span className="font-bold">Ghi chú trưởng đoàn: </span>
                    {currentDay.dispatcherNote}
                  </div>
                )}

                {/* Activities Timeline */}
                {!currentDay || currentDay.activities.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Chưa có hoạt động nào được cập nhật cho ngày này.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {currentDay.activities.map((act) => (
                      <div key={act.id} className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 shrink-0 tabular-nums text-center min-w-[92px]">
                            {act.timeStart} – {act.timeEnd}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-extrabold text-slate-900 leading-snug">
                              {act.title}
                            </div>
                            {act.location && (
                              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{act.location}</span>
                              </div>
                            )}
                            {act.details && (
                              <p className="text-xs text-slate-500 leading-relaxed">
                                {act.details}
                              </p>
                            )}
                            {act.notes && (
                              <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1 inline-block">
                                Lưu ý: {act.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`self-start shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getActivityBadge(act.status)}`}
                        >
                          {act.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'map' && (
          <Suspense
            fallback={
              <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-xs font-semibold text-slate-500">
                Đang tải bản đồ tuyến đường...
              </div>
            }
          >
            <LiveRouteMap
              trip={readOnlyTrip}
              readOnly
              guestJoinCode={joinCode}
            />
          </Suspense>
        )}

        {activeTab === 'group' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Staff contacts & Share code */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Ban điều hành &amp; Liên hệ đoàn</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thông tin trưởng đoàn, hướng dẫn viên và tài xế phụ trách
                  </p>
                </div>

                {staffMembers.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có thông tin trưởng đoàn / hướng dẫn viên.</p>
                ) : (
                  <div className="space-y-2.5">
                    {staffMembers.map((staff) => (
                      <div
                        key={staff.id}
                        className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {staff.avatar}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{staff.name}</div>
                            <div className="text-[11px] font-semibold text-teal-700">{staff.role}</div>
                          </div>
                        </div>
                        {staff.phone && (
                          <a
                            href={`tel:${staff.phone}`}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-mono font-bold inline-flex items-center gap-1.5 shrink-0 hover:bg-teal-100"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{staff.phone}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Share code reminder for family */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                <div className="text-xs font-extrabold text-slate-900">Mã tham gia chuyến đi</div>
                <p className="text-xs text-slate-500">
                  Dùng mã này để mở lại lịch trình trên thiết bị khác mà không cần đăng ký tài khoản.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                  <span className="font-mono text-lg font-black tracking-[0.2em] text-slate-900">
                    {joinCode}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopy('code')}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                    >
                      {copiedType === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'code' ? 'Đã chép' : 'Mã'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy('link')}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-teal-600 text-xs font-bold text-white hover:bg-teal-500 inline-flex items-center gap-1"
                    >
                      {copiedType === 'link' ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'link' ? 'Đã chép link' : 'Chép link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Passenger list (no private phone numbers exposed) */}
            <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Danh sách Hành khách trong đoàn</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {presentCount}/{guestTrip.membersTotal} thành viên đã điểm danh có mặt
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg tabular-nums">
                  {guestTrip.membersTotal} thành viên
                </span>
              </div>

              {passengerMembers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">Chưa có hành khách nào trong danh sách.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {passengerMembers.map((member) => (
                    <div key={member.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0">
                          {member.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{member.name}</div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                            <span>{member.role}</span>
                            {member.invitedByName && (
                              <span className="text-teal-700 font-medium">
                                • Người thân của {member.invitedByName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-lg border font-bold text-[11px] inline-flex items-center gap-1 ${
                          member.attendanceStatus === 'Có mặt'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : member.attendanceStatus === 'Vắng mặt'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {member.attendanceStatus === 'Có mặt' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>{member.attendanceStatus || 'Chưa điểm danh'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Tab Bar (Thumb-Zone Ergonomics) */}
      <nav
        aria-label="Điều hướng hành khách"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 grid grid-cols-3 h-16"
      >
        {(
          [
            { id: 'schedule', label: 'Lịch trình', icon: Calendar },
            { id: 'map', label: 'Bản đồ', icon: Navigation },
            { id: 'group', label: 'Đoàn & Liên hệ', icon: Users },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                isActive ? 'text-teal-700 bg-teal-50/60' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
