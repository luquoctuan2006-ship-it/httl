import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Sliders,
  Sparkles,
  ShieldAlert,
  Settings,
  Database,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Car,
  Wallet,
  Calendar,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Filter,
  Download,
  Upload,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Activity,
  Check,
  AlertCircle,
  FileText,
  Compass,
  Navigation,
  DollarSign,
  Flag,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { TripData, Waypoint, TripMember, Activity as ActivityType } from '../../types/travel';
import { authenticatedFetch } from '../../api';


// 6. QUẢN LÝ QUY TẮC ĐIỀU PHỐI (DISPATCH RULE ENGINE)
// - Quy tắc thời gian đệm (buffer minutes).
// - Giới hạn ngân sách và ngưỡng cảnh báo.
// - Tốc độ di chuyển theo địa hình.
// - Kiểm tra xung đột lịch trình và điều kiện tối ưu.
// ============================================================================
export const AdminDispatchRulesView: React.FC = () => {
  const [bufferMinutes, setBufferMinutes] = useState('20');
  const [startHour, setStartHour] = useState('07:30');
  const [endHour, setEndHour] = useState('21:30');

  const [budgetCapDaily, setBudgetCapDaily] = useState('8.000.000 ₫');
  const [budgetAlertThreshold, setBudgetAlertThreshold] = useState('90%');
  const [contingencyPercent, setContingencyPercent] = useState('10%');

  const [citySpeedLimit, setCitySpeedLimit] = useState('40 km/h');
  const [highwaySpeedLimit, setHighwaySpeedLimit] = useState('60 km/h');
  const [passSpeedLimit, setPassSpeedLimit] = useState('35 km/h');

  const [conflictChecks, setConflictChecks] = useState({
    overlapTime: true,
    openingHoursMismatch: true,
    impossibleTransit: true,
    hotelCheckinConflict: true,
  });

  const [optimizationPriorities, setOptimizationPriorities] = useState({
    costSaving: true,
    transitTimeMinimization: true,
    avoidHotNoonSun: true,
    elderlyPacing: false,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Nạp từ server
  useEffect(() => {
    authenticatedFetch('/api/admin/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config?.rules) {
          const r = data.config.rules;
          if (r.bufferMinutes) setBufferMinutes(r.bufferMinutes);
          if (r.startHour) setStartHour(r.startHour);
          if (r.endHour) setEndHour(r.endHour);
          if (r.budgetCapDaily) setBudgetCapDaily(r.budgetCapDaily);
          if (r.budgetAlertThreshold) setBudgetAlertThreshold(r.budgetAlertThreshold);
          if (r.contingencyPercent) setContingencyPercent(r.contingencyPercent);
          if (r.citySpeedLimit) setCitySpeedLimit(r.citySpeedLimit);
          if (r.highwaySpeedLimit) setHighwaySpeedLimit(r.highwaySpeedLimit);
          if (r.passSpeedLimit) setPassSpeedLimit(r.passSpeedLimit);
          if (r.conflictChecks) setConflictChecks(r.conflictChecks);
          if (r.optimizationPriorities) setOptimizationPriorities(r.optimizationPriorities);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveRules = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await authenticatedFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: {
            bufferMinutes,
            startHour,
            endHour,
            budgetCapDaily,
            budgetAlertThreshold,
            contingencyPercent,
            citySpeedLimit,
            highwaySpeedLimit,
            passSpeedLimit,
            conflictChecks,
            optimizationPriorities,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Không thể lưu quy tắc điều phối (mã lỗi: ${res.status})`);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu quy tắc điều phối';
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Quy tắc & Ràng buộc Hệ thống
            </span>
            <span className="text-xs text-slate-400 font-semibold">Dispatch Rule Engine</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Quản lý Quy tắc Điều phối Lịch trình</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Thiết lập các tiêu chuẩn vận hành: Ràng buộc thời gian đệm, Trần ngân sách, Quy tắc tốc độ di chuyển, Động cơ phát hiện xung đột và Tiêu chí tối ưu AI.
          </p>
        </div>

        <button
          onClick={handleSaveRules}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-teal-900/40 transition active:scale-95 shrink-0"
        >
          {isSaved ? <Check className="w-4 h-4 text-white" /> : isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Sliders className="w-4 h-4" />}
          <span>{isSaved ? 'Đã Lưu Thành Công!' : isSaving ? 'Đang lưu...' : 'Lưu Quy Tắc Điều Phối'}</span>
        </button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}

      {isSaved && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-teal-500/40 bg-teal-500/10 text-teal-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
          <span>Đã lưu thành công các quy tắc điều phối vào hệ thống!</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quy tắc 1: Thời gian */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Clock className="w-4 h-4 text-teal-400" />
            <h3>1. Quy tắc Thời gian (Time Buffer)</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Thời gian đệm tối thiểu giữa 2 hoạt động</label>
              <input
                type="text"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span className="text-[10px] text-slate-500">Phút chuẩn bị lên xuống xe và tập trung đoàn</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Giờ khởi hành sớm nhất</label>
                <input
                  type="text"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Giờ kết thúc tour muộn nhất</label>
                <input
                  type="text"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quy tắc 2: Giới hạn ngân sách */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Wallet className="w-4 h-4 text-amber-400" />
            <h3>2. Giới hạn Ngân sách (Budget Thresholds)</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Hạn mức chi phí trần mỗi ngày</label>
              <input
                type="text"
                value={budgetCapDaily}
                onChange={(e) => setBudgetCapDaily(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Ngưỡng cảnh báo chi tiêu</label>
                <input
                  type="text"
                  value={budgetAlertThreshold}
                  onChange={(e) => setBudgetAlertThreshold(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Dự phòng rủi ro</label>
                <input
                  type="text"
                  value={contingencyPercent}
                  onChange={(e) => setContingencyPercent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quy tắc 3: Tốc độ di chuyển */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Car className="w-4 h-4 text-sky-400" />
            <h3>3. Định mức Tốc độ Di chuyển Thực tế</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Đô thị nội thành</label>
              <input
                type="text"
                value={citySpeedLimit}
                onChange={(e) => setCitySpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-teal-300 font-bold"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Quốc lộ / Cao tốc</label>
              <input
                type="text"
                value={highwaySpeedLimit}
                onChange={(e) => setHighwaySpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-teal-300 font-bold"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Đèo dốc nguy hiểm</label>
              <input
                type="text"
                value={passSpeedLimit}
                onChange={(e) => setPassSpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Quy tắc 4: Xung đột lịch trình & Điều kiện tối ưu */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <h3>4. Động cơ Phát hiện Xung đột & Ưu tiên AI</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
              <input
                type="checkbox"
                checked={conflictChecks.overlapTime}
                onChange={(e) => setConflictChecks({ ...conflictChecks, overlapTime: e.target.checked })}
                className="rounded accent-teal-500"
              />
              <span className="text-slate-200">Trùng giờ hoạt động</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
              <input
                type="checkbox"
                checked={conflictChecks.openingHoursMismatch}
                onChange={(e) => setConflictChecks({ ...conflictChecks, openingHoursMismatch: e.target.checked })}
                className="rounded accent-teal-500"
              />
              <span className="text-slate-200">Đến khi điểm đóng cửa</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
              <input
                type="checkbox"
                checked={optimizationPriorities.transitTimeMinimization}
                onChange={(e) => setOptimizationPriorities({ ...optimizationPriorities, transitTimeMinimization: e.target.checked })}
                className="rounded accent-teal-500"
              />
              <span className="text-slate-200">Tối thiểu thời gian di chuyển</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
              <input
                type="checkbox"
                checked={optimizationPriorities.avoidHotNoonSun}
                onChange={(e) => setOptimizationPriorities({ ...optimizationPriorities, avoidHotNoonSun: e.target.checked })}
                className="rounded accent-teal-500"
              />
              <span className="text-slate-200">Tránh nắng nóng 11h-14h</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

