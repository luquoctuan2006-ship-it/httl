import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Car,
  Wallet,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { authenticatedFetch } from '../../api';
import { DarkCheckboxTile, DarkSectionCard, Field, TextInput } from '../common/Field';

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
        <DarkSectionCard
          title="1. Quy tắc Thời gian (Time Buffer)"
          icon={<Clock className="w-4 h-4 text-teal-400" />}
        >
          <div className="space-y-3 text-xs">
            <Field
              variant="dark"
              label="Thời gian đệm tối thiểu giữa 2 hoạt động"
              hint="Phút chuẩn bị lên xuống xe và tập trung đoàn"
            >
              <TextInput
                variant="dark"
                type="text"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field variant="dark" label="Giờ khởi hành sớm nhất">
                <TextInput
                  variant="dark"
                  type="text"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                />
              </Field>
              <Field variant="dark" label="Giờ kết thúc tour muộn nhất">
                <TextInput
                  variant="dark"
                  type="text"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </DarkSectionCard>

        {/* Quy tắc 2: Giới hạn ngân sách */}
        <DarkSectionCard
          title="2. Giới hạn Ngân sách (Budget Thresholds)"
          icon={<Wallet className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-3 text-xs">
            <Field variant="dark" label="Hạn mức chi phí trần mỗi ngày">
              <TextInput
                variant="dark"
                type="text"
                value={budgetCapDaily}
                onChange={(e) => setBudgetCapDaily(e.target.value)}
                className="text-amber-300 font-bold"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field variant="dark" label="Ngưỡng cảnh báo chi tiêu">
                <TextInput
                  variant="dark"
                  type="text"
                  value={budgetAlertThreshold}
                  onChange={(e) => setBudgetAlertThreshold(e.target.value)}
                />
              </Field>
              <Field variant="dark" label="Dự phòng rủi ro">
                <TextInput
                  variant="dark"
                  type="text"
                  value={contingencyPercent}
                  onChange={(e) => setContingencyPercent(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </DarkSectionCard>

        {/* Quy tắc 3: Tốc độ di chuyển */}
        <DarkSectionCard
          title="3. Định mức Tốc độ Di chuyển Thực tế"
          icon={<Car className="w-4 h-4 text-sky-400" />}
        >
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Field variant="dark" label="Đô thị nội thành">
              <TextInput
                variant="dark"
                type="text"
                value={citySpeedLimit}
                onChange={(e) => setCitySpeedLimit(e.target.value)}
                className="text-teal-300 font-bold"
              />
            </Field>
            <Field variant="dark" label="Quốc lộ / Cao tốc">
              <TextInput
                variant="dark"
                type="text"
                value={highwaySpeedLimit}
                onChange={(e) => setHighwaySpeedLimit(e.target.value)}
                className="text-teal-300 font-bold"
              />
            </Field>
            <Field variant="dark" label="Đèo dốc nguy hiểm">
              <TextInput
                variant="dark"
                type="text"
                value={passSpeedLimit}
                onChange={(e) => setPassSpeedLimit(e.target.value)}
                className="text-amber-300 font-bold"
              />
            </Field>
          </div>
        </DarkSectionCard>

        {/* Quy tắc 4: Xung đột lịch trình & Điều kiện tối ưu */}
        <DarkSectionCard
          title="4. Động cơ Phát hiện Xung đột & Ưu tiên Điều phối"
          icon={<ShieldAlert className="w-4 h-4 text-purple-400" />}
        >
          <div className="grid grid-cols-2 gap-3 text-xs">
            <DarkCheckboxTile
              label="Trùng giờ hoạt động"
              checked={conflictChecks.overlapTime}
              onChange={(checked) => setConflictChecks({ ...conflictChecks, overlapTime: checked })}
            />
            <DarkCheckboxTile
              label="Đến khi điểm đóng cửa"
              checked={conflictChecks.openingHoursMismatch}
              onChange={(checked) => setConflictChecks({ ...conflictChecks, openingHoursMismatch: checked })}
            />
            <DarkCheckboxTile
              label="Tối thiểu thời gian di chuyển"
              checked={optimizationPriorities.transitTimeMinimization}
              onChange={(checked) =>
                setOptimizationPriorities({ ...optimizationPriorities, transitTimeMinimization: checked })
              }
            />
            <DarkCheckboxTile
              label="Tránh nắng nóng 11h-14h"
              checked={optimizationPriorities.avoidHotNoonSun}
              onChange={(checked) =>
                setOptimizationPriorities({ ...optimizationPriorities, avoidHotNoonSun: checked })
              }
            />
          </div>
        </DarkSectionCard>
      </div>
    </div>
  );
};

