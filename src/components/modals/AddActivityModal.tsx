import React, { useState } from 'react';
import { X, Clock, MapPin, Tag, FileText, Plus, DollarSign } from 'lucide-react';
import { Activity } from '../../types/travel';
import { validateActivityTimeRange } from '../../utils/trip/tripSyncHelpers';
import { lookupCoordinates } from '../../utils/route/vietnamGeo';
import { PlaceAutocompleteInput, type PlaceCoordinates } from '../common/PlaceAutocompleteInput';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayIndex: number;
  days?: { dayIndex: number; dayName?: string; dateNum?: number; fullDate?: string }[];
  defaultLocation?: string;
  onAdd: (activity: Activity, targetDayIndex?: number) => void;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  dayIndex,
  days,
  defaultLocation = '',
  onAdd,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(dayIndex);
  const [title, setTitle] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [location, setLocation] = useState(defaultLocation);
  const [coordinates, setCoordinates] = useState<PlaceCoordinates | undefined>(() =>
    defaultLocation ? lookupCoordinates(defaultLocation) ?? undefined : undefined,
  );
  const [type, setType] = useState<Activity['type']>('sightseeing');
  const [status, setStatus] = useState<Activity['status']>('Đã xác nhận');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [timeError, setTimeError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedDay(dayIndex);
      setTitle('');
      setTimeStart('09:00');
      setTimeEnd('11:00');
      setLocation(defaultLocation);
      setCoordinates(defaultLocation ? lookupCoordinates(defaultLocation) ?? undefined : undefined);
      setType('sightseeing');
      setStatus('Đã xác nhận');
      setDetails('');
      setCost(0);
      setTimeError(null);
    }
  }, [dayIndex, defaultLocation, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const rangeError = validateActivityTimeRange(timeStart, timeEnd);
    if (rangeError) {
      setTimeError(rangeError);
      return;
    }
    setTimeError(null);

    const resolvedLocation = location.trim() || defaultLocation || 'Điểm tham quan';
    const coords = coordinates || lookupCoordinates(resolvedLocation) || lookupCoordinates(title.trim());

    const newActivity: Activity = {
      id: `act-custom-${Date.now()}`,
      title: title.trim(),
      timeStart,
      timeEnd,
      location: resolvedLocation,
      type,
      status,
      details: details.trim() || 'Hoạt động được lập theo lịch trình',
      cost: Number(cost) || 0,
      ...(coords ? { coordinates: coords } : {}),
    };

    onAdd(newActivity, selectedDay);
    setTitle('');
    setDetails('');
    setCost(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white text-neutral-900 rounded-3xl max-w-lg w-full border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-neutral-950 border-b-2 border-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-extrabold">Thêm hoạt động cho Ngày {selectedDay}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {days && days.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Chọn ngày trong hành trình</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white font-semibold text-neutral-900"
              >
                {days.map((d) => (
                  <option key={d.dayIndex} value={d.dayIndex}>
                    Ngày {d.dayIndex} ({d.dayName ? `${d.dayName} ${d.dateNum || ''}`.trim() : d.fullDate || `Chặng ${d.dayIndex}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Tên hoạt động</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Dùng bữa trưa hải sản, tham quan di tích"
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Giờ bắt đầu</span>
              </label>
              <input
                type="time"
                required
                value={timeStart}
                onChange={(e) => {
                  setTimeStart(e.target.value);
                  setTimeError(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Giờ kết thúc</span>
              </label>
              <input
                type="time"
                required
                value={timeEnd}
                onChange={(e) => {
                  setTimeEnd(e.target.value);
                  setTimeError(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none font-mono"
              />
            </div>
          </div>

          {timeError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
              {timeError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Địa điểm</span>
            </label>
            <PlaceAutocompleteInput
              value={location}
              onChangeText={setLocation}
              coordinates={coordinates}
              onChangeCoordinates={setCoordinates}
              placeholder="VD: Nhà hàng Bé Đen, Thị trấn Lăng Cô"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Loại hoạt động</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white"
              >
                <option value="sightseeing">Tham quan</option>
                <option value="meal">Ăn uống</option>
                <option value="transport">Di chuyển xe</option>
                <option value="hotel">Khách sạn / Lưu trú</option>
                <option value="checkin">Check-in / Nhận phòng</option>
                <option value="briefing">Điều hành / Tập trung</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white"
              >
                <option value="Đã xác nhận">Đã xác nhận</option>
                <option value="Cần xử lý">Cần xử lý</option>
                <option value="Đang diễn ra">Đang diễn ra</option>
                <option value="Hoàn tất">Hoàn tất</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              <span>Dự toán chi phí hoạt động (VNĐ)</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={cost}
              onChange={(e) => setCost(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="500000"
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Ghi chú chi tiết cho tài xế & HDV</span>
            </label>
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="VD: Đặt trước phòng VIP, số lượng 18 khách"
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
            >
              Lưu hoạt động
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
