import React from 'react';
import { AlertTriangle, Cloud, Download, HardDrive, RefreshCw, X } from 'lucide-react';
import type { TripData } from '../../types/travel';

interface SyncConflictModalProps {
  localTrip: TripData | null;
  serverTrip: TripData | null;
  isResolving?: boolean;
  onKeepLocal: () => void;
  onUseServer: () => void;
  onDismiss: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  localTrip,
  serverTrip,
  isResolving = false,
  onKeepLocal,
  onUseServer,
  onDismiss,
}) => {
  if (!localTrip || !serverTrip) return null;

  const localActsCount = (localTrip.days || []).reduce((s, d) => s + (d.activities?.length || 0), 0);
  const serverActsCount = (serverTrip.days || []).reduce((s, d) => s + (d.activities?.length || 0), 0);

  const handleDownloadBackup = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(localTrip, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `${localTrip.code || localTrip.id}-ban-cuc-bo.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white text-neutral-900 rounded-3xl max-w-xl w-full border border-neutral-200 shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 py-4 bg-neutral-950 text-white border-b-2 border-red-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold truncate">Phát hiện xung đột đồng bộ dữ liệu</h3>
              <p className="text-[11px] text-neutral-400 truncate">
                {localTrip.title} ({localTrip.code})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isResolving}
            aria-label="Đóng hộp thoại xung đột"
            className="p-2 rounded-lg hover:bg-white/10 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-neutral-700 overflow-y-auto">
          <p className="leading-relaxed">
            Trong lúc bạn chỉnh sửa ngoại tuyến hoặc từ phiên khác, dữ liệu chuyến đi trên máy chủ đã được cập nhật lên{' '}
            <strong className="font-mono text-neutral-950">phiên bản v{serverTrip.version ?? '?'}</strong>. Để không làm mất công sức của bạn, hãy chọn phiên bản muốn giữ lại:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-blue-950">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span>Bản chỉnh sửa của bạn</span>
              </div>
              <div className="text-[11px] text-blue-900 space-y-0.5 font-medium">
                <div>Tên tour: <strong>{localTrip.title}</strong></div>
                <div>Lịch trình: <strong>{localTrip.days.length} ngày · {localActsCount} hoạt động</strong></div>
                <div>Thành viên: <strong>{(localTrip.members || []).length}</strong> · Hóa đơn: <strong>{(localTrip.invoices || []).length}</strong></div>
                <div className="font-mono text-[10px] text-blue-700">Dựa trên phiên bản: v{localTrip.version ?? 1}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-neutral-950">
                <Cloud className="w-4 h-4 text-red-600" />
                <span>Bản hiện có trên máy chủ</span>
              </div>
              <div className="text-[11px] text-neutral-700 space-y-0.5 font-medium">
                <div>Tên tour: <strong>{serverTrip.title}</strong></div>
                <div>Lịch trình: <strong>{serverTrip.days.length} ngày · {serverActsCount} hoạt động</strong></div>
                <div>Thành viên: <strong>{(serverTrip.members || []).length}</strong> · Hóa đơn: <strong>{(serverTrip.invoices || []).length}</strong></div>
                <div className="font-mono text-[10px] text-neutral-500">Phiên bản máy chủ: v{serverTrip.version ?? 1}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isResolving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải bản của tôi (.json)</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onUseServer}
                disabled={isResolving}
                className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Dùng bản máy chủ
              </button>
              <button
                type="button"
                onClick={onKeepLocal}
                disabled={isResolving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResolving ? 'animate-spin' : ''}`} />
                <span>{isResolving ? 'Đang ghi...' : 'Giữ bản của tôi (Ghi đè)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
