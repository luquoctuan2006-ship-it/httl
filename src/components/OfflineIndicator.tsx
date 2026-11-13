import React from 'react';
import { WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  pendingSyncCount?: number;
  cachedAt?: string | null;
  onRetrySync?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  pendingSyncCount = 0,
  cachedAt,
  onRetrySync,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
        !isOnline
          ? 'bg-amber-950/90 text-amber-100 border-amber-500/40 shadow-md'
          : 'bg-sky-50 text-sky-900 border-sky-200'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Cloud className="w-4 h-4 text-sky-600 shrink-0" />
        )}
        <span>
          {!isOnline
            ? `Chế độ Offline: Đang hiển thị lịch trình & dữ liệu đã lưu trên máy${
                cachedAt ? ` (${new Date(cachedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})` : ''
              }.${pendingSyncCount > 0 ? ` Có ${pendingSyncCount} thay đổi chờ đồng bộ khi có mạng.` : ''}`
            : `Đã có mạng trở lại: còn ${pendingSyncCount} chuyến đi đang chờ đồng bộ lên máy chủ.`}
        </span>
      </div>

      {isOnline && pendingSyncCount > 0 && onRetrySync && (
        <button
          type="button"
          onClick={onRetrySync}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đồng bộ ngay</span>
        </button>
      )}
    </div>
  );
};
