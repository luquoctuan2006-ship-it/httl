import React from 'react';
import { X, AlertTriangle, CloudRain, Clock, Truck, CheckCircle, ShieldAlert } from 'lucide-react';
import { OperationalAlert } from '../types/travel';

interface AlertsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: OperationalAlert[];
  onDismissAlert: (id: string) => void;
  onTriggerAI: () => void;
}

export const AlertsListModal: React.FC<AlertsListModalProps> = ({
  isOpen,
  onClose,
  alerts,
  onDismissAlert,
  onTriggerAI,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-sm font-extrabold">Trung tâm Cảnh báo Vận hành Thời gian thực</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3.5 max-h-[65vh] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tất cả các tuyến đường và lịch trình đang vận hành an toàn! Không có cảnh báo mới.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white transition flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      alert.category === 'weather'
                        ? 'bg-amber-100 text-amber-700'
                        : alert.category === 'schedule'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {alert.category === 'weather' ? (
                      <CloudRain className="w-4 h-4" />
                    ) : alert.category === 'schedule' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                      <span className="text-[10px] text-slate-400 font-medium">{alert.timeAgo}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => onDismissAlert(alert.id)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shrink-0"
                >
                  Đã giải quyết
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onTriggerAI}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1.5"
          >
            <span>Kích hoạt Gemini AI tái lập trình tuyến</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
