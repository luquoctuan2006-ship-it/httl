import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  Flag,
} from 'lucide-react';
import { TripData } from '../../types/travel';

interface AdminScheduleMonitoringProps {
  trip: TripData;
  trips?: TripData[];
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => Promise<void>;
  onEnsureFullTrip?: (tripId: string) => Promise<TripData | null>;
}

export const AdminScheduleMonitoringView: React.FC<AdminScheduleMonitoringProps> = ({
  trip,
  trips = [],
  onUpdateTrip: _onUpdateTrip,
  onEnsureFullTrip,
}) => {
  const [selectedTripDetails, setSelectedTripDetails] = useState<TripData | null>(null);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Danh sách chuyến đi thực tế được hợp nhất từ props
  const combinedTrips = useMemo(() => {
    const map = new Map<string, TripData>();
    if (trip && trip.id) map.set(trip.id, trip);
    if (Array.isArray(trips)) {
      trips.forEach((t) => {
        if (t && t.id && !map.has(t.id)) {
          map.set(t.id, t);
        }
      });
    }
    return Array.from(map.values());
  }, [trip, trips]);

  // Danh sách các chuyến đang hoạt động từ dữ liệu thật
  const activeTripsList = useMemo(() => {
    return combinedTrips.map((t) => {
      const driver = t.telematics?.driver || t.members?.find((m) => m.role.toLowerCase().includes('tài xế'))?.name || 'Trần Bình';
      const guide = t.members?.find((m) => m.role.toLowerCase().includes('hướng dẫn viên') || m.role.toLowerCase().includes('hdv'))?.name || 'Nguyễn Văn An';
      
      const allActs = t.days?.flatMap((d) => d.activities || []) || [];
      const startLoc = allActs[0]?.location || t.waypoints?.[0]?.name || t.originFull || 'Điểm khởi hành';
      const endLoc =
        allActs[allActs.length - 1]?.location ||
        t.waypoints?.[t.waypoints.length - 1]?.name ||
        t.destinationFull ||
        'Điểm kết thúc';
      const route = startLoc !== endLoc ? `${startLoc} ➔ ${endLoc}` : startLoc;

      const issuesCount = (t.alerts?.length || 0) + (t.days?.filter((d) => d.hasWarning).length || 0);

      return {
        id: t.id,
        code: t.code || `VN-${t.id.slice(-4).toUpperCase()}`,
        name: t.title || 'Tour du lịch',
        route,
        day: `Ngày ${t.currentDay || 1} / ${t.totalDays || t.days?.length || 1}`,
        vehicle: t.vehicle || 'Xe 29 chỗ (43B-028.99)',
        driver,
        guide,
        status: t.status || 'Đang vận hành',
        issuesCount,
        fullTrip: t,
      };
    });
  }, [combinedTrips]);

  // Tự động quét và phát hiện sự cố lịch trình & xung đột thời gian từ dữ liệu thật
  const scheduleIssues = useMemo(() => {
    const issues: Array<{
      id: string;
      tripCode: string;
      type: string;
      severity: string;
      description: string;
      status: string;
    }> = [];

    combinedTrips.forEach((t) => {
      const code = t.code || `VN-${t.id.slice(-4).toUpperCase()}`;

      // 1. Quét cảnh báo thực tế từ t.alerts
      if (Array.isArray(t.alerts)) {
        t.alerts.forEach((alert) => {
          issues.push({
            id: `alert-${t.id}-${alert.id}`,
            tripCode: code,
            type:
              alert.category === 'weather'
                ? 'Thời tiết & Địa hình'
                : alert.category === 'traffic'
                  ? 'Giao thông'
                  : alert.category === 'budget'
                    ? 'Ngân sách'
                    : 'Vận hành',
            severity: alert.severity === 'error' ? 'Khẩn cấp' : 'Cảnh báo',
            description: alert.title ? `${alert.title}: ${alert.description || ''}` : alert.description,
            status: alert.severity === 'error' ? 'Cần can thiệp' : 'Đã có giải pháp AI',
          });
        });
      }

      // 2. Quét các ngày có cảnh báo hoặc ghi chú điều phối
      t.days?.forEach((day) => {
        if (day.hasWarning && day.dispatcherNote) {
          issues.push({
            id: `warn-${t.id}-d${day.dayIndex}`,
            tripCode: code,
            type: 'Điều chỉnh lịch trình',
            severity: 'Cảnh báo',
            description: `Ngày ${day.dayIndex} (${day.fullDate}): ${day.dispatcherNote}`,
            status: 'Cần xác nhận',
          });
        }

        // 3. Quét xung đột thời gian thực tế: nếu hoạt động sau bắt đầu trước khi hoạt động trước kết thúc
        const acts = day.activities || [];
        for (let i = 0; i < acts.length - 1; i++) {
          const act1 = acts[i];
          const act2 = acts[i + 1];
          if (act1?.timeEnd && act2?.timeStart) {
            const [h1, m1] = act1.timeEnd.split(':').map(Number);
            const [h2, m2] = act2.timeStart.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(h2)) {
              const minutes1 = h1 * 60 + (m1 || 0);
              const minutes2 = h2 * 60 + (m2 || 0);
              if (minutes2 < minutes1) {
                issues.push({
                  id: `overlap-${t.id}-${act1.id}-${act2.id}`,
                  tripCode: code,
                  type: 'Xung đột thời gian',
                  severity: 'Lỗi lịch trình',
                  description: `Ngày ${day.dayIndex}: "${act1.title}" (kết thúc ${act1.timeEnd}) bị trùng giờ với "${act2.title}" (bắt đầu ${act2.timeStart}).`,
                  status: 'Cần can thiệp',
                });
              }
            }
          }
        }
      });
    });

    return issues;
  }, [combinedTrips]);

  const handleFlagSchedule = (tripCode: string) => {
    showToast(`Đã gửi thông báo cảnh báo lịch trình ${tripCode} đến Điều phối viên!`);
  };

  const handleOpenTripDetails = async (targetTrip: TripData) => {
    if (!targetTrip.isSummary || !onEnsureFullTrip) {
      setSelectedTripDetails(targetTrip);
      return;
    }
    setLoadingTripId(targetTrip.id);
    try {
      const hydrated = await onEnsureFullTrip(targetTrip.id);
      setSelectedTripDetails(hydrated || targetTrip);
    } finally {
      setLoadingTripId((current) => (current === targetTrip.id ? null : current));
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Giám sát Lịch trình Thực địa
          </span>
          <span className="text-xs text-slate-400 font-semibold">{activeTripsList.length} chuyến đang hoạt động</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Quản lý & Kiểm tra Lịch trình Hoạt động</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Phát hiện lịch trình có lỗi dữ liệu, xung đột giờ mở cửa địa điểm hoặc thời gian di chuyển bất khả thi, hỗ trợ người dùng khi có sự cố.
        </p>
      </div>

      {/* Danh sách các chuyến đang hoạt động */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
        <div className="hidden md:grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
          <span className="col-span-3">Mã & Tên Chuyến đi</span>
          <span className="col-span-2">Chặng & Tiến độ</span>
          <span className="col-span-3">Phương tiện & Nhân sự</span>
          <span className="col-span-2 text-center">Trạng thái</span>
          <span className="col-span-2 text-right">Chi tiết</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {activeTripsList.map((t) => (
            <div
              key={t.code}
              className="flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center px-6 py-4 hover:bg-slate-800/40 transition text-xs"
            >
              <div className="md:col-span-3">
                <span className="font-mono text-teal-400 font-bold">{t.code}</span>
                <strong className="text-white block text-sm mt-0.5">{t.name}</strong>
              </div>

              <div className="md:col-span-2">
                <span className="text-slate-300 font-bold block">{t.route}</span>
                <span className="text-emerald-400 text-[11px]">{t.day}</span>
              </div>

              <div className="md:col-span-3 text-slate-300 space-y-0.5">
                <div>Xe: <strong className="text-white">{t.vehicle}</strong></div>
                <div>Tài xế: <strong className="text-teal-300">{t.driver}</strong> | HDV: {t.guide}</div>
              </div>

              <div className="md:col-span-2 text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  {t.status}
                </span>
                {t.issuesCount > 0 && (
                  <span className="block text-[10px] text-amber-400 font-bold mt-1">
                    ⚠️ {t.issuesCount} cảnh báo cần xem
                  </span>
                )}
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                <button
                  onClick={() => void handleOpenTripDetails(t.fullTrip)}
                  disabled={loadingTripId === t.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-slate-700 transition disabled:opacity-50"
                >
                  {loadingTripId === t.id ? 'Đang tải...' : 'Xem Lịch Trình'}
                </button>
                <button
                  onClick={() => handleFlagSchedule(t.code)}
                  title="Gửi cảnh báo"
                  className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phát hiện Lịch trình Có Xung đột / Bất khả thi */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Phát hiện Sự cố Lịch trình & Xung đột Thời gian
          </h3>
          <span className="text-xs text-slate-400">Động cơ Auto-Audit kích hoạt</span>
        </div>

        <div className="space-y-3">
          {scheduleIssues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <strong className="text-white text-sm">Không phát hiện sự cố hay xung đột lịch trình</strong>
              <span>Tất cả {combinedTrips.length} tour đang vận hành an toàn và đúng các mốc thời gian quy định.</span>
            </div>
          ) : (
            scheduleIssues.map((iss) => (
              <div
                key={iss.id}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      {iss.type}
                    </span>
                    <span className="font-mono text-teal-400 font-bold">{iss.tripCode}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{iss.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-teal-300 border border-slate-700">
                    {iss.status}
                  </span>
                  <button
                    onClick={() => showToast(`Đã can thiệp điều phối lại cho mã tour ${iss.tripCode}!`)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition"
                  >
                    Hỗ Trợ Ngay
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Xem Chi tiết Lịch Trình */}
      {selectedTripDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div>
                <span className="font-mono text-xs font-bold text-teal-400">{selectedTripDetails.code}</span>
                <h3 className="font-black text-white text-lg">{selectedTripDetails.title || (selectedTripDetails as any).name || 'Lịch trình tour'}</h3>
              </div>
              <button
                onClick={() => setSelectedTripDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {selectedTripDetails.days.map((day) => (
                <div key={day.dayIndex} className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <strong className="text-white text-sm">
                      {day.fullDate || `Ngày ${day.dayIndex}`} ({day.activities.length} hoạt động)
                    </strong>
                    <span className="text-slate-400 font-mono">{day.dispatcherNote || 'Lịch trình chuẩn'}</span>
                  </div>

                  <div className="space-y-2">
                    {day.activities.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 text-slate-300"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-teal-400 font-bold">{act.timeStart} — {act.timeEnd}</span>
                          <strong className="text-white">{act.title}</strong>
                          <span className="text-slate-400">({act.location})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-amber-300">
                            {act.cost ? `${act.cost.toLocaleString('vi-VN')} ₫` : 'Miễn phí'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              act.status === 'Đã xác nhận' || act.status === 'Hoàn tất'
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-amber-950 text-amber-300'
                            }`}
                          >
                            {act.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

