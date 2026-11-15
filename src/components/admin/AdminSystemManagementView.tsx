import React, { useState, useEffect } from 'react';
import {
  Settings,
  AlertTriangle,
  Download,
  RefreshCw,
  Check,
  FileText,
} from 'lucide-react';
import { TripData } from '../../types/travel';
import { authenticatedFetch } from '../../api';

export const AdminSystemManagementView: React.FC<{ trip: TripData }> = ({ trip }) => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('60 phút');
  const [backupAutoSchedule, setBackupAutoSchedule] = useState('Hằng ngày lúc 00:00');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await authenticatedFetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch {}

    try {
      const resCfg = await authenticatedFetch('/api/admin/config');
      if (resCfg.ok) {
        const dataCfg = await resCfg.json();
        if (dataCfg.config) {
          if (dataCfg.config.maintenanceMode !== undefined) setMaintenanceMode(dataCfg.config.maintenanceMode);
          if (dataCfg.config.sessionTimeout) setSessionTimeout(dataCfg.config.sessionTimeout);
          if (dataCfg.config.backupAutoSchedule) setBackupAutoSchedule(dataCfg.config.backupAutoSchedule);
        }
      }
    } catch {}
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleSaveSystemConfig = async () => {
    setSaveError(null);
    try {
      const res = await authenticatedFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceMode,
          sessionTimeout,
          backupAutoSchedule,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setSaveError(data?.error || `Không thể lưu cấu hình lên máy chủ (HTTP ${res.status})`);
        return;
      }
      fetchAuditLogs();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      setSaveError('Không thể kết nối máy chủ để lưu cấu hình.');
    }
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trip, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `voyager-system-backup-${trip.code || 'master'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    // Ghi nhận Audit Log lên server
    try {
      await authenticatedFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditAction: `Xuất bản sao lưu JSON toàn bộ hệ thống (${trip.code || 'master'}.json)`,
        }),
      });
      fetchAuditLogs();
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Banner thông báo chế độ bảo trì */}
      {maintenanceMode && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <strong className="block text-sm font-black text-amber-200">Hệ thống đang ở Chế độ Bảo trì Toàn cục</strong>
              <span>Khách du lịch và người dùng thông thường bị tạm khóa thao tác chỉnh sửa lịch trình trực tiếp.</span>
            </div>
          </div>
          <button
            onClick={async () => {
              setSaveError(null);
              try {
                const res = await authenticatedFetch('/api/admin/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ maintenanceMode: false }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.success) {
                  setSaveError(data?.error || `Không thể tắt chế độ bảo trì (HTTP ${res.status})`);
                  return;
                }
                setMaintenanceMode(false);
                fetchAuditLogs();
              } catch {
                setSaveError('Không thể kết nối máy chủ để tắt chế độ bảo trì.');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shrink-0"
          >
            Tắt bảo trì ngay
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Hạ tầng & Hệ thống
            </span>
            <span className="text-xs text-slate-400 font-semibold">Core System & Audit</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Quản lý Hệ thống & Nhật ký Hoạt động</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Cấu hình tham số toàn cục hệ thống, chế độ bảo trì, sao lưu JSON và theo dõi nhật ký hoạt động (Audit log) của toàn bộ người dùng.
          </p>
        </div>

        <button
          onClick={handleSaveSystemConfig}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/40 transition active:scale-95 shrink-0"
        >
          {isSaved ? <Check className="w-4 h-4 text-white" /> : <Settings className="w-4 h-4" />}
          <span>{isSaved ? 'Đã Lưu Cấu Hình!' : 'Lưu Cấu Hình Hệ Thống'}</span>
        </button>
      </div>

      {saveError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-between gap-3">
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-rose-200 hover:text-white underline text-[11px]"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* 1. Cấu hình hệ thống (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            1. Cấu hình Hệ thống Toàn cục
          </h3>

          <div className="space-y-4 text-xs">
            {/* Chế độ bảo trì */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <strong className="text-white block">Chế độ bảo trì hệ thống</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">Tạm khóa truy cập của khách khi nâng cấp</p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`w-12 h-6 rounded-full p-1 transition ${maintenanceMode ? 'bg-rose-600' : 'bg-slate-700'}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    maintenanceMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Session Timeout */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">Thời gian hết hạn phiên đăng nhập</label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="30 phút">30 phút không hoạt động</option>
                <option value="60 phút">60 phút không hoạt động</option>
                <option value="120 phút">120 phút không hoạt động</option>
              </select>
            </div>

            {/* Sao lưu tự động */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">Lịch sao lưu dữ liệu tự động</label>
              <select
                value={backupAutoSchedule}
                onChange={(e) => setBackupAutoSchedule(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="Hằng ngày lúc 00:00">Hằng ngày lúc 00:00</option>
                <option value="Mỗi 12 giờ">Mỗi 12 giờ</option>
                <option value="Hằng tuần">Hằng tuần vào Chủ nhật</option>
              </select>
            </div>

            {/* Nút Export Backup */}
            <div className="pt-2">
              <button
                onClick={handleExportBackup}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất bản sao lưu hệ thống (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Nhật ký hoạt động (Audit log) (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              2. Nhật ký Hoạt động (Audit Log)
            </h3>
            <button
              onClick={fetchAuditLogs}
              disabled={isLoadingLogs}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>{isLoadingLogs ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Chưa có nhật ký hoạt động nào.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 text-xs max-h-[380px] overflow-y-auto">
              {auditLogs.map((log) => {
                const statusColor =
                  log.status === 'Cảnh báo'
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                    : log.status === 'Thất bại'
                    ? 'text-rose-400 bg-rose-950/60 border-rose-800'
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-800';

                return (
                  <div key={log.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <strong className="text-white">{log.user}</strong>
                        {log.status && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${statusColor}`}>
                            {log.status}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{log.time}</span>
                    </div>
                    <p className="text-slate-300 pl-3.5 leading-relaxed">{log.action}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};