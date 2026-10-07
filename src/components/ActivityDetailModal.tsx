import React from 'react';
import { X, Clock, MapPin, CheckCircle2, User, Phone, Tag } from 'lucide-react';
import { Activity } from '../types/travel';

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onUpdateStatus: (id: string, newStatus: Activity['status']) => void;
  canEdit?: boolean;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  onClose,
  onUpdateStatus,
  canEdit = true,
}) => {
  if (!activity) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            <h3 className="text-sm font-extrabold">Chi tiết hoạt động điều phối</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded inline-block mb-1.5 border border-teal-200">
              {activity.timeStart} — {activity.timeEnd}
            </div>
            <h4 className="text-base font-extrabold text-slate-900 leading-snug">
              {activity.title}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{activity.location}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Trạng thái hiện tại:</span>
              <span className="font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {activity.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Phân loại:</span>
              <span className="font-semibold text-slate-700 uppercase text-[10px]">
                {activity.type}
              </span>
            </div>
            {activity.cost !== undefined && activity.cost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Chi phí dự toán/thực tế:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {activity.cost.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-slate-400 font-medium block mb-1">Ghi chú điều hành:</span>
              <p className="text-slate-700 leading-relaxed font-normal">{activity.details}</p>
            </div>
          </div>

          {canEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cập nhật nhanh tiến độ:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onUpdateStatus(activity.id, 'Hoàn tất'); onClose(); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                >
                  Đánh dấu Hoàn tất
                </button>
                <button
                  onClick={() => { onUpdateStatus(activity.id, 'Đang diễn ra'); onClose(); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition"
                >
                  Đang diễn ra
                </button>
                <button
                  onClick={() => { onUpdateStatus(activity.id, 'Cần xử lý'); onClose(); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                >
                  Báo động Cần xử lý
                </button>
                <button
                  onClick={() => { onUpdateStatus(activity.id, 'Đã xác nhận'); onClose(); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition"
                >
                  Đã xác nhận
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
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
