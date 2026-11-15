/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Edit3, Calendar, DollarSign, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { TripData } from '../../types/travel';
import {
  formatTripDatesRange,
  parseTripDatesRange,
  validateTripDateRange,
} from '../../utils/tripSyncHelpers';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripData;
  onSave: (updatedFields: Partial<TripData>) => Promise<void>;
}

export const EditTripModal: React.FC<EditTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  onSave,
}) => {
  const initialRange = parseTripDatesRange(trip.dates, trip.totalDays);
  const [title, setTitle] = useState(trip.title);
  const [code, setCode] = useState(trip.code);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [dateError, setDateError] = useState<string | null>(null);
  const [status, setStatus] = useState(trip.status);
  const [originFull, setOriginFull] = useState(trip.originFull);
  const [destinationFull, setDestinationFull] = useState(trip.destinationFull);
  const [budgetTotalInput, setBudgetTotalInput] = useState(
    String(Math.round(trip.budgetTotal ?? 0))
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState(trip.vehicle || '');
  const [driver, setDriver] = useState(
    trip.telematics?.driver && trip.telematics.driver !== 'Chưa phân công'
      ? trip.telematics.driver
      : '',
  );
  const [driverPhone, setDriverPhone] = useState(trip.telematics?.driverPhone || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const range = parseTripDatesRange(trip.dates, trip.totalDays);
      setTitle(trip.title);
      setCode(trip.code);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setDateError(null);
      setStatus(trip.status);
      setOriginFull(trip.originFull);
      setDestinationFull(trip.destinationFull);
      setBudgetTotalInput(String(Math.round(trip.budgetTotal ?? 0)));
      setBudgetError(null);
      setVehicle(trip.vehicle || '');
      setDriver(
        trip.telematics?.driver && trip.telematics.driver !== 'Chưa phân công'
          ? trip.telematics.driver
          : '',
      );
      setDriverPhone(trip.telematics?.driverPhone || '');
    }
  }, [isOpen, trip]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rangeErr = validateTripDateRange(startDate, endDate);
    if (rangeErr) {
      setDateError(rangeErr);
      return;
    }

    const trimmedBudget = budgetTotalInput.trim();
    const parsedBudget = trimmedBudget === '' ? NaN : Number(trimmedBudget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setBudgetError('Vui lòng nhập ngân sách hợp lệ (số VNĐ không âm).');
      return;
    }

    setDateError(null);
    setBudgetError(null);
    setIsSaving(true);
    try {
      const budgetTotal = Math.round(parsedBudget);
      const budgetUsed = trip.budgetUsed || 0;
      const budgetRemaining = Math.max(0, budgetTotal - budgetUsed);
      const budgetUsedPercent = budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0;
      const formattedDates = formatTripDatesRange(startDate, endDate) || trip.dates;
      const cleanVehicle = vehicle.trim() || trip.vehicle || '';
      const cleanDriver = driver.trim() || 'Chưa phân công';

      await onSave({
        title: title.trim() || trip.title,
        code: code.trim().toUpperCase() || trip.code,
        dates: formattedDates,
        status,
        originFull: originFull.trim() || trip.originFull,
        destinationFull: destinationFull.trim() || trip.destinationFull,
        budgetTotal,
        budgetRemaining,
        budgetUsedPercent,
        vehicle: cleanVehicle,
        telematics: {
          ...trip.telematics,
          vehicleType: cleanVehicle,
          driver: cleanDriver,
          driverPhone: driverPhone.trim(),
        },
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Cập nhật thông tin Chuyến đi</h3>
              <p className="text-[11px] text-teal-200/80">Chỉnh sửa tên, mã tour, thời gian và thông số vận hành</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[78dvh] overflow-y-auto">
          {/* Title & Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên chuyến đi / Tour du lịch *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-bold text-slate-900"
                placeholder="Ví dụ: Khám phá miền Trung 7 ngày"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mã chuyến đi *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-mono font-bold text-teal-700 uppercase"
                placeholder="VN-1024"
              />
            </div>
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Ngày khởi hành *</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setStartDate(nextStart);
                  if (endDate && nextStart > endDate) {
                    setEndDate(nextStart);
                  }
                  setDateError(null);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Ngày kết thúc *</span>
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateError(null);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trạng thái vận hành *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-medium text-slate-800"
              >
                <option value="Chuẩn bị">Chuẩn bị</option>
                <option value="Đang vận hành">Đang vận hành</option>
                <option value="Hoàn thành">Hoàn thành</option>
              </select>
            </div>
          </div>

          {dateError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
              {dateError}
            </div>
          )}

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Điểm khởi hành</span>
              </label>
              <input
                type="text"
                value={originFull}
                onChange={(e) => setOriginFull(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800"
                placeholder="Đà Nẵng"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>Điểm đến chính</span>
              </label>
              <input
                type="text"
                value={destinationFull}
                onChange={(e) => setDestinationFull(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800"
                placeholder="Huế"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tổng ngân sách dự trù (VNĐ) *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={100000}
                required
                value={budgetTotalInput}
                onChange={(e) => {
                  setBudgetTotalInput(e.target.value);
                  setBudgetError(null);
                }}
                className="w-full px-3 py-2 pr-14 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 font-mono font-bold text-slate-900"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                VNĐ
              </span>
            </div>
            {budgetError && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">{budgetError}</p>
            )}
          </div>

          {/* Vehicle & Driver */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Truck className="w-4 h-4 text-teal-600" />
              <span>Phương tiện & Tài xế phụ trách</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Loại xe</label>
                <input
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="VD: Xe 29 chỗ"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Tên tài xế</label>
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="Chưa phân công"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">SĐT tài xế</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="VD: 09xx xxx xxx"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-md shadow-teal-900/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
