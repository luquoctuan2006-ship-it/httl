import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  MapPin,
  Sliders,
  Sparkles,
  Calendar,
  TrendingUp,
  Cpu,
  ChevronRight,
} from 'lucide-react';
import { TripData } from '../../types/travel';
import { authenticatedFetch } from '../../api';

interface AdminDashboardProps {
  trip: TripData;
  trips?: TripData[];
  onNavigate: (tab: string) => void;
  onOpenAIPlanner: () => void;
  onOpenAIOptimize: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({
  trip,
  trips = [],
  onNavigate,
  onOpenAIPlanner,
  onOpenAIOptimize,
}) => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [activeModel, setActiveModel] = useState<string>('gemini-3.5-flash');
  const [userCount, setUserCount] = useState({ total: 0, active: 0, locked: 0 });
  const [aiMetrics, setAiMetrics] = useState({ totalCalls: 0, successRate: 100, failedCalls: 0 });

  const [userDates, setUserDates] = useState<Date[]>([]);
  const [aiRequestDates, setAiRequestDates] = useState<Date[]>([]);

  const parseDateValue = (rawCreatedAt: any, fallbackText?: string): Date | null => {
    const sec = rawCreatedAt?._seconds ?? rawCreatedAt?.seconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) return new Date(sec * 1000);
    if (typeof fallbackText === 'string') {
      const m = fallbackText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const tm = fallbackText.match(/(\d{1,2}):(\d{2})/);
        return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), tm ? Number(tm[1]) : 12, tm ? Number(tm[2]) : 0);
      }
    }
    return null;
  };

  // Load stats from server if available
  useEffect(() => {
    let isMounted = true;
    authenticatedFetch('/api/admin/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config?.aiModel && isMounted) {
          setActiveModel(data.config.aiModel);
        }
      })
      .catch(() => {});

    (async () => {
      try {
        const allUsers: any[] = [];
        let pageToken: string | undefined;
        do {
          const qs = pageToken ? `?limit=1000&pageToken=${encodeURIComponent(pageToken)}` : '?limit=1000';
          const res = await authenticatedFetch(`/api/admin/users${qs}`);
          const data = res.ok ? await res.json() : null;
          if (!data?.users || !isMounted) break;
          allUsers.push(...data.users);
          pageToken = data.nextPageToken;
        } while (pageToken);

        if (isMounted && allUsers.length > 0) {
          const locked = allUsers.filter((u) => u.isLocked).length;
          setUserCount({ total: allUsers.length, active: allUsers.length - locked, locked });
          setUserDates(allUsers.map((u) => parseDateValue(null, u.createdAt)).filter((d): d is Date => Boolean(d)));
        }
      } catch {
        // ignored
      }
    })();

    authenticatedFetch('/api/admin/ai-logs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isMounted) {
          const requests = Array.isArray(data.requests) ? data.requests : [];
          const errors = Array.isArray(data.errors) ? data.errors : [];
          const totalCalls = requests.length;
          const failedCalls = errors.length;
          const successRate = totalCalls > 0 ? Number((((totalCalls - failedCalls) / totalCalls) * 100).toFixed(1)) : 100;
          setAiMetrics({ totalCalls, successRate, failedCalls });
          setAiRequestDates(
            requests.map((r: any) => parseDateValue(r.createdAt, r.time)).filter((d: Date | null): d is Date => Boolean(d)),
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

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

  const totalTrips = combinedTrips.length;
  const totalActivitiesCount = useMemo(() => {
    return combinedTrips.reduce(
      (acc, t) =>
        acc + (t.isSummary ? t.totalActivities || 0 : t.days?.flatMap((d) => d.activities || []).length || 0),
      0,
    );
  }, [combinedTrips]);
  const totalSchedulesCreated = useMemo(() => {
    return combinedTrips.reduce((acc, t) => acc + (t.isSummary ? t.totalDays || 0 : t.days?.length || 0), 0);
  }, [combinedTrips]);

  // Biểu đồ tổng hợp từ mốc thời gian thực của nhật ký AI và ngày tạo tài khoản
  const chartBars = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayLabels = ['00-06h', '06-09h', '09-12h', '12-15h', '15-18h', '18-24h'];
    const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const labels =
      timeframe === 'day'
        ? dayLabels
        : timeframe === 'month'
          ? ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4']
          : Array.from({ length: 7 }, (_, i) => {
              const d = new Date(todayStart - (6 - i) * 86_400_000);
              return weekdayNames[d.getDay()];
            });

    const bucketIndex = (d: Date): number => {
      const ms = d.getTime();
      if (timeframe === 'day') {
        if (ms < todayStart || ms >= todayStart + 86_400_000) return -1;
        const h = d.getHours();
        return h < 6 ? 0 : h < 9 ? 1 : h < 12 ? 2 : h < 15 ? 3 : h < 18 ? 4 : 5;
      }
      if (timeframe === 'week') {
        const diffDays = Math.floor((ms - (todayStart - 6 * 86_400_000)) / 86_400_000);
        return diffDays >= 0 && diffDays < 7 ? diffDays : -1;
      }
      const diffWeeks = Math.floor((ms - (todayStart - 27 * 86_400_000)) / (7 * 86_400_000));
      return diffWeeks >= 0 && diffWeeks < 4 ? diffWeeks : -1;
    };

    const aiSeries = Array.from({ length: labels.length }, () => 0);
    const userSeries = Array.from({ length: labels.length }, () => 0);
    for (const d of aiRequestDates) {
      const idx = bucketIndex(d);
      if (idx >= 0) aiSeries[idx] += 1;
    }
    for (const d of userDates) {
      const idx = bucketIndex(d);
      if (idx >= 0) userSeries[idx] += 1;
    }
    const maxVal = Math.max(...aiSeries, ...userSeries, 1);

    return labels.map((label, idx) => {
      const aiCount = aiSeries[idx];
      const uCount = userSeries[idx];
      return {
        label,
        ai: aiCount,
        users: uCount,
        height: `${aiCount === 0 ? 4 : Math.min(100, Math.max(12, Math.round((aiCount / maxVal) * 85)))}%`,
        userHeight: `${uCount === 0 ? 4 : Math.min(100, Math.max(12, Math.round((uCount / maxVal) * 85)))}%`,
      };
    });
  }, [timeframe, aiRequestDates, userDates]);

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#080A10] via-[#0B0E17] to-[#080A10] p-6 md:p-8 text-white border border-neutral-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-72 h-72 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-600/20 text-blue-300 border border-blue-500/40">
                Admin Executive Console
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-neutral-900 text-neutral-300 border border-neutral-700">
                Hệ điều hành Điều phối Du lịch
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Bảng Điều khiển & Thống kê Quản trị Toàn cục
            </h1>
            <p className="text-xs md:text-sm text-neutral-300 max-w-2xl">
              Giám sát thời gian thực các chỉ số tài khoản người dùng, chuyến đi đang điều phối, tần suất gọi mô hình AI Gemini, và tỷ lệ thành công của hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAIPlanner}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-950/40 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chạy AI Lập Lịch</span>
            </button>
            <button
              onClick={onOpenAIOptimize}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/40 text-red-300 font-bold text-xs transition"
            >
              <Sliders className="w-4 h-4" />
              <span>Điều phối Tối ưu Tuyến</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Khối Chỉ số Tổng quan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Người dùng */}
        <div
          onClick={() => onNavigate('users')}
          className="cursor-pointer group rounded-2xl border border-neutral-800 bg-[#090B11] p-5 shadow-xl hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Người dùng Hệ thống</span>
            <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-400 group-hover:bg-blue-600/25 transition">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">{userCount.total}</span>
            <span className="text-xs font-bold text-blue-400 tabular-nums">+{userCount.active} đang hoạt động</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2">
            <span>Tài khoản bị khóa: <strong className="text-red-400 tabular-nums">{userCount.locked}</strong></span>
            <span className="text-blue-400 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
              Quản lý <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Metric 2: Chuyến đi & Lịch trình */}
        <div
          onClick={() => onNavigate('trips')}
          className="cursor-pointer group rounded-2xl border border-neutral-800 bg-[#090B11] p-5 shadow-xl hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Chuyến đi & Lịch trình</span>
            <div className="p-2.5 rounded-xl bg-neutral-800 text-white group-hover:bg-neutral-700 transition">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">{totalTrips}</span>
            <span className="text-xs font-bold text-blue-400 tabular-nums">{totalSchedulesCreated} ngày lịch trình</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2">
            <span>Hoạt động tổng: <strong className="text-white tabular-nums">{totalActivitiesCount}</strong></span>
            <span className="text-blue-400 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
              Giám sát <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Metric 3: Lượt sử dụng AI */}
        <div
          onClick={() => onNavigate('ai')}
          className="cursor-pointer group rounded-2xl border border-neutral-800 bg-[#090B11] p-5 shadow-xl hover:border-red-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Lượt sử dụng AI Gemini</span>
            <div className="p-2.5 rounded-xl bg-red-600/15 text-red-400 group-hover:bg-red-600/25 transition">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">{aiMetrics.totalCalls}</span>
            <span className="text-xs font-bold text-red-400 truncate">Model: {activeModel}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2">
            <span>Tỷ lệ thành công: <strong className="text-blue-400 tabular-nums">{aiMetrics.successRate}%</strong></span>
            <span className="text-red-400 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
              Cấu hình AI <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Metric 4: Địa điểm & Dữ liệu hoạch định */}
        <div
          onClick={() => onNavigate('trips')}
          className="cursor-pointer group rounded-2xl border border-neutral-800 bg-[#090B11] p-5 shadow-xl hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Địa điểm & Dữ liệu</span>
            <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-400 group-hover:bg-blue-600/25 transition">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">{trip.waypoints?.length || 0}</span>
            <span className="text-xs font-bold text-neutral-300">Điểm du lịch chuẩn</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2">
            <span>Trạng thái: <strong className="text-blue-400">Đã kiểm duyệt</strong></span>
            <span className="text-blue-400 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
              Danh mục <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Biểu đồ Hoạt động & Lối tắt Quản trị */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Biểu đồ Hoạt động (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div>
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Biểu đồ Hoạt động Lập lịch & Yêu cầu AI
              </h3>
              <p className="text-xs text-neutral-400">Thống kê số lượt người dùng và số lần gọi AI theo thời gian</p>
            </div>

            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setTimeframe('day')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${timeframe === 'day' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${timeframe === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}`}
              >
                7 ngày qua
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${timeframe === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}`}
              >
                Tháng này
              </button>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div className="h-56 flex items-end justify-between gap-2 pt-6 px-2">
            {chartBars.map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full max-w-[42px] flex items-end justify-center gap-1.5 h-full">
                  <div
                    style={{ height: bar.height }}
                    className="w-1/2 rounded-t-lg bg-blue-600/90 group-hover:bg-blue-500 transition-all relative"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-900 text-[10px] text-blue-300 font-bold px-1.5 py-0.5 rounded border border-neutral-700 whitespace-nowrap z-10">
                      AI: {bar.ai}
                    </span>
                  </div>
                  <div
                    style={{ height: bar.userHeight }}
                    className="w-1/2 rounded-t-lg bg-red-600/85 group-hover:bg-red-500 transition-all relative"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-900 text-[10px] text-red-300 font-bold px-1.5 py-0.5 rounded border border-neutral-700 whitespace-nowrap z-10">
                      User: {bar.users}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-neutral-400">{bar.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 border-t border-neutral-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-600" />
              <span className="text-neutral-300">Yêu cầu AI (Lập lịch / Tối ưu)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-600" />
              <span className="text-neutral-300">Tài khoản đăng ký mới</span>
            </div>
          </div>
        </div>

        {/* Lối tắt quản trị */}
        <div className="lg:col-span-4 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-neutral-800 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-red-400" />
            Lối tắt Phân hệ Quản trị
          </h3>

          <div className="grid gap-2.5">
            <button
              onClick={() => onNavigate('users')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-left transition group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-400" />
                <div>
                  <strong className="text-xs text-white block">Quản lý Người dùng & RBAC</strong>
                  <span className="text-[10px] text-neutral-400">Xem danh sách, khóa/mở, đổi vai trò</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
            </button>

            <button
              onClick={() => onNavigate('trips')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 text-left transition group"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-neutral-200" />
                <div>
                  <strong className="text-xs text-white block">Quản lý Chuyến đi</strong>
                  <span className="text-[10px] text-neutral-400">Danh sách, lịch trình và dữ liệu hoạch định</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
            </button>

            <button
              onClick={() => onNavigate('ai')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-red-500/50 text-left transition group"
            >
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-red-400" />
                <div>
                  <strong className="text-xs text-white block">Giám sát & Cấu hình AI Gemini</strong>
                  <span className="text-[10px] text-neutral-400">Đổi Model thực tế, xem log lỗi, test ping</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-red-400 group-hover:translate-x-1 transition" />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};
