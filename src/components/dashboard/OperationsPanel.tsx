import React from 'react';
import {
  AlertTriangle,
  CloudRain,
  Clock,
  ArrowRight,
  RefreshCw,
  Bell,
  BellOff,
  Route,
  Wallet,
} from 'lucide-react';
import { TripData } from '../../types/travel';

interface OperationsPanelProps {
  trip: TripData;
  unreadAlertCount?: number;
  onOpenAlertsModal: () => void;
  onOpenApplyAIPlan: () => void;
  isAIApplied: boolean;
  onScanAlerts?: () => Promise<void>;
  isScanningAlerts?: boolean;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  readOnly?: boolean;
}

export const OperationsPanel: React.FC<OperationsPanelProps> = ({
  trip,
  unreadAlertCount,
  onOpenAlertsModal,
  onOpenApplyAIPlan,
  isAIApplied,
  onScanAlerts,
  isScanningAlerts = false,
  notificationsEnabled = false,
  onToggleNotifications,
  readOnly = false,
}) => {
  const alerts = trip.alerts || [];
  const totalAlerts = alerts.length;
  const unseenAlerts = typeof unreadAlertCount === 'number' ? unreadAlertCount : totalAlerts;

  const previewAlerts = [...alerts]
    .sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 };
      return (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
    })
    .slice(0, 3);

  const suggestionsCount = trip.aiSuggestions?.length || 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Cảnh báo chuyến đi */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <h3 className="text-sm font-bold text-neutral-950 truncate">
                Cảnh báo cần chú ý
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!readOnly && onToggleNotifications && (
                <button
                  type="button"
                  onClick={onToggleNotifications}
                  title={notificationsEnabled ? 'Đang bật thông báo đẩy' : 'Bật thông báo đẩy khi có cảnh báo mới'}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    notificationsEnabled
                      ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                      : 'text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100'
                  }`}
                >
                  {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
              )}
              {!readOnly && onScanAlerts && (
                <button
                  type="button"
                  onClick={onScanAlerts}
                  disabled={isScanningAlerts}
                  title="Quét lại cảnh báo thời tiết, lịch trình và ngân sách"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningAlerts ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              )}
              <span
                className={`text-xs font-semibold tabular-nums ${
                  totalAlerts === 0
                    ? 'text-blue-700'
                    : unseenAlerts > 0
                      ? 'text-red-600'
                      : 'text-neutral-500'
                }`}
              >
                {totalAlerts === 0
                  ? 'Ổn định'
                  : unseenAlerts > 0
                    ? `${unseenAlerts} chưa xem`
                    : `${totalAlerts} đã xem`}
              </span>
            </div>
          </div>

          <div className="divide-y divide-neutral-100 mt-1">
            {previewAlerts.length > 0 ? (
              previewAlerts.map((alert) => {
                const isBudgetWarn = alert.category === 'budget' && alert.severity !== 'error';
                const isWeather = alert.category === 'weather';
                return (
                  <div key={alert.id} className="py-3 flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isWeather || isBudgetWarn
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {isWeather ? (
                        <CloudRain className="w-3.5 h-3.5" />
                      ) : alert.category === 'budget' ? (
                        <Wallet className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-950 truncate">{alert.title}</h4>
                        <span className="text-[11px] text-neutral-400 shrink-0 tabular-nums">{alert.timeAgo}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed line-clamp-2">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-neutral-500 py-4">
                Không có cảnh báo xung đột lịch trình, thời tiết hay ngân sách.
              </p>
            )}
          </div>
        </div>

        <div className="pt-2.5 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onOpenAlertsModal}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 transition cursor-pointer"
          >
            <span>Xem tất cả ({totalAlerts})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Gợi ý tối ưu lịch trình (chỉ chủ chuyến) */}
      {!readOnly && (
        <div className="bg-[#090B11] text-white rounded-xl p-4 sm:p-5 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 min-w-0">
                <Route className="w-4 h-4 text-blue-400 shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">Tối ưu lịch trình</h3>
              </div>
              <span className="text-[11px] font-medium text-red-400 shrink-0 tabular-nums">
                {isAIApplied ? 'Đã áp dụng' : suggestionsCount > 0 ? `${suggestionsCount} đề xuất` : 'Chưa phân tích'}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {trip.aiSuggestions && trip.aiSuggestions.length > 0 ? (
                trip.aiSuggestions.slice(0, 2).map((sug, idx) => (
                  <div key={sug.id || idx} className="text-xs border-b border-neutral-800/90 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-neutral-100 truncate">{sug.title}</span>
                      {sug.badge && (
                        <span className="font-mono text-[11px] text-blue-400 shrink-0">{sug.badge}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">{sug.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-400 py-1">
                  Kiểm tra các điểm nghẽn giờ di chuyển và đề xuất sắp xếp lại lịch trình hợp lý hơn.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onOpenApplyAIPlan}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isAIApplied
                  ? 'bg-neutral-800 border border-blue-500/40 text-blue-300 hover:bg-neutral-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isAIApplied ? 'Đã áp dụng tối ưu' : 'Mở công cụ tối ưu lịch trình'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
