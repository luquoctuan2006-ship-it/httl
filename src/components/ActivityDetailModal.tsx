import React, { useState } from 'react';
import { X, Clock, MapPin, Tag, Edit3, Trash2, CheckCircle2, DollarSign, FileText } from 'lucide-react';
import { Activity } from '../types/travel';

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onUpdateStatus: (id: string, newStatus: Activity['status']) => void;
  onEditActivity?: (updatedActivity: Activity) => void;
  onDeleteActivity?: (id: string) => void;
  canEdit?: boolean;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  onClose,
  onUpdateStatus,
  onEditActivity,
  onDeleteActivity,
  canEdit = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(activity?.title || '');
  const [timeStart, setTimeStart] = useState(activity?.timeStart || '08:00');
  const [timeEnd, setTimeEnd] = useState(activity?.timeEnd || '09:30');
  const [location, setLocation] = useState(activity?.location || '');
  const [cost, setCost] = useState(activity?.cost || 0);
  const [type, setType] = useState<Activity['type']>(activity?.type || 'sightseeing');
  const [details, setDetails] = useState(activity?.details || '');

  React.useEffect(() => {
    if (activity) {
      setTitle(activity.title);
      setTimeStart(activity.timeStart);
      setTimeEnd(activity.timeEnd);
      setLocation(activity.location);
      setCost(activity.cost || 0);
      setType(activity.type);
      setDetails(activity.details);
      setIsEditing(false);
    }
  }, [activity]);

  if (!activity) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !onEditActivity) return;
    const updated: Activity = {
      ...activity,
      title: title.trim(),
      timeStart,
      timeEnd,
      location: location.trim(),
      cost: Number(cost) || 0,
      type,
      details: details.trim(),
    };
    onEditActivity(updated);
    setIsEditing(false);
    onClose();
  };

  const handleDelete = () => {
    if (!onDeleteActivity) return;
    if (window.confirm(`Bạn có chắc muốn xóa hoạt động "${activity.title}" khỏi lịch trình?`)) {
      onDeleteActivity(activity.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            <h3 className="text-sm font-extrabold">
              {isEditing ? 'Chỉnh sửa hoạt động' : 'Chi tiết hoạt động lịch trình'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && onEditActivity && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-full hover:bg-white/20 transition text-white"
                title="Sửa thông tin"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên hoạt động</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-teal-600" /> Giờ bắt đầu
                </label>
                <input
                  type="text"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-teal-600" /> Giờ kết thúc
                </label>
                <input
                  type="text"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-600" /> Địa điểm
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-teal-600" /> Chi phí (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại hoạt động</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                >
                  <option value="sightseeing">Tham quan</option>
                  <option value="meal">Ăn uống</option>
                  <option value="transport">Di chuyển xe</option>
                  <option value="hotel">Khách sạn / Nghỉ ngơi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-teal-600" /> Ghi chú điều hành
              </label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        ) : (
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

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              {canEdit && onDeleteActivity ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hoạt động</span>
                </button>
              ) : <span />}

              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

