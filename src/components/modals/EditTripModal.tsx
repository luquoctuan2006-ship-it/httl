/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Edit3, Calendar, DollarSign, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { TripData } from '../../types/travel';
import { buildCalendarDayMeta, syncDaysWithStartDate, syncTripRouteMetadata } from '../../utils/route/tripRouteSync';
import { recomputeTripActivityStats } from '../../utils/trip/tripHelpers';
import { resolveScaledAllocationsForBudget } from '../../utils/trip/budgetAlerts';
import { lookupCoordinates } from '../../utils/route/vietnamGeo';
import { PlaceAutocompleteInput, type PlaceCoordinates } from '../common/PlaceAutocompleteInput';
import {
  formatTripDatesRange,
  parseTripDatesRange,
  validateTripDateRange,
} from '../../utils/trip/tripSyncHelpers';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripData;
  onSave: (updatedFields: Partial<TripData>) => Promise<void>;
}

function resolveInitialPlaceCoords(trip: TripData, placeName: string): PlaceCoordinates | undefined {
  const clean = (placeName || '').trim().toLowerCase();
  if (clean && Array.isArray(trip.waypoints)) {
    const wp = trip.waypoints.find((w) => w.name.trim().toLowerCase() === clean);
    if (wp && (Math.abs(wp.lat) > 0.0001 || Math.abs(wp.lng) > 0.0001)) {
      return { lat: wp.lat, lng: wp.lng };
    }
  }
  const matched = lookupCoordinates(placeName);
  return matched ? { lat: matched.lat, lng: matched.lng } : undefined;
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
  const [originCoords, setOriginCoords] = useState<PlaceCoordinates | undefined>(() =>
    resolveInitialPlaceCoords(trip, trip.originFull),
  );
  const [destinationFull, setDestinationFull] = useState(trip.destinationFull);
  const [destinationCoords, setDestinationCoords] = useState<PlaceCoordinates | undefined>(() =>
    resolveInitialPlaceCoords(trip, trip.destinationFull),
  );
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
  const [truncateWarning, setTruncateWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const range = parseTripDatesRange(trip.dates, trip.totalDays);
      setTitle(trip.title);
      setCode(trip.code);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setDateError(null);
      setTruncateWarning(null);
      setStatus(trip.status);
      setOriginFull(trip.originFull);
      setOriginCoords(resolveInitialPlaceCoords(trip, trip.originFull));
      setDestinationFull(trip.destinationFull);
      setDestinationCoords(resolveInitialPlaceCoords(trip, trip.destinationFull));
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

  useEffect(() => {
    setTruncateWarning(null);
  }, [startDate, endDate]);

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

    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    const syncedDays = syncDaysWithStartDate(trip.days || [], startDate);
    const targetDaysCount =
      Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
        ? Math.max(1, Math.min(30, Math.round((endMs - startMs) / 86_400_000) + 1))
        : Math.max(1, syncedDays.length || trip.totalDays || 1);

    const droppedDays = targetDaysCount < syncedDays.length ? syncedDays.slice(targetDaysCount) : [];
    const droppedActivitiesCount = droppedDays.reduce((sum, d) => sum + (d.activities?.length || 0), 0);
    if (droppedDays.length > 0 && !truncateWarning) {
      setTruncateWarning(
        `Rút ngắn còn ${targetDaysCount} ngày sẽ xóa ${droppedDays.length} ngày cuối` +
          (droppedActivitiesCount > 0 ? ` (${droppedActivitiesCount} hoạt động)` : '') +
          `. Bấm "Xác nhận lưu thay đổi" để tiếp tục.`,
      );
      return;
    }

    setDateError(null);
    setBudgetError(null);
    setTruncateWarning(null);
    setIsSaving(true);
    try {
      const budgetTotal = Math.round(parsedBudget);
      const budgetUsed = trip.budgetUsed || 0;
      const budgetRemaining = Math.max(0, budgetTotal - budgetUsed);
      const budgetUsedPercent = budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0;
      const scaledAllocations = resolveScaledAllocationsForBudget(trip, budgetTotal);
      const formattedDates = formatTripDatesRange(startDate, endDate) || trip.dates;
      const cleanVehicle = vehicle.trim() || trip.vehicle || '';
      const cleanDriver = driver.trim() || 'Chưa phân công';
      const cleanOrigin = originFull.trim() || trip.originFull;
      const cleanDestination = destinationFull.trim() || trip.destinationFull;

      let resizedDays = syncedDays.slice(0, targetDaysCount);
      for (let idx = resizedDays.length + 1; idx <= targetDaysCount; idx += 1) {
        resizedDays.push({
          dayIndex: idx,
          ...buildCalendarDayMeta(startDate, idx),
          confirmedCount: 0,
          pendingCount: 0,
          dispatcherNote: 'Ngày bổ sung theo khoảng thời gian mới',
          activities: [],
        });
      }
      const droppedActivityIds = new Set(droppedDays.flatMap((d) => (d.activities || []).map((a) => a.id)));
      const cleanedInvoices =
        droppedDays.length > 0
          ? (trip.invoices || []).map((inv) => ({
              ...inv,
              dayIndex: inv.dayIndex && inv.dayIndex > resizedDays.length ? resizedDays.length : inv.dayIndex,
              linkedActivityId:
                inv.linkedActivityId && droppedActivityIds.has(inv.linkedActivityId)
                  ? undefined
                  : inv.linkedActivityId,
            }))
          : trip.invoices;

      const stats = recomputeTripActivityStats(resizedDays);
      const draftWithEndpoints: TripData = {
        ...trip,
        origin: cleanOrigin.slice(0, 3).toUpperCase(),
        originFull: cleanOrigin,
        destination: cleanDestination.slice(0, 3).toUpperCase(),
        destinationFull: cleanDestination,
        totalDays: stats.days.length,
        currentDay: Math.min(trip.currentDay || 1, stats.days.length),
        ...(cleanedInvoices ? { invoices: cleanedInvoices } : {}),
        ...stats,
      };
      const routeSynced = syncTripRouteMetadata(draftWithEndpoints, {
        origin: originCoords || null,
        destination: destinationCoords || null,
      });
      const matchedDriverId = (trip.members || []).find(
        (m) => m.role === 'Tài xế' && m.name === cleanDriver,
      )?.id;

      await onSave({
        title: title.trim() || trip.title,
        code: code.trim().toUpperCase() || trip.code,
        dates: formattedDates,
        status,
        origin: draftWithEndpoints.origin,
        originFull: cleanOrigin,
        destination: draftWithEndpoints.destination,
        destinationFull: cleanDestination,
        totalDays: stats.days.length,
        currentDay: draftWithEndpoints.currentDay,
        ...stats,
        ...(cleanedInvoices ? { invoices: cleanedInvoices } : {}),
        waypoints: routeSynced.waypoints,
        destinationsCount: routeSynced.destinationsCount,
        totalKm: routeSynced.totalKm,
        budgetTotal,
        budgetRemaining,
        budgetUsedPercent,
        ...(scaledAllocations ? { customCategoryAllocations: scaledAllocations } : {}),
        vehicle: cleanVehicle,
        telematics: {
          ...trip.telematics,
          from: cleanOrigin,
          to: cleanDestination,
          vehicleType: cleanVehicle,
          driver: cleanDriver,
          driverPhone: driverPhone.trim(),
          driverMemberId: matchedDriverId,
        },
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white text-neutral-900 rounded-3xl max-w-xl w-full border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b-2 border-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Cập nhật thông tin Chuyến đi</h3>
              <p className="text-[11px] text-neutral-300">Chỉnh sửa tên, mã tour, thời gian và thông số vận hành</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 transition text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[78dvh] overflow-y-auto">
          {/* Title & Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Tên chuyến đi / Tour du lịch *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 font-bold text-neutral-950"
                placeholder="Ví dụ: Khám phá miền Trung 7 ngày"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Mã chuyến đi *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 font-mono font-bold text-blue-700 uppercase"
                placeholder="VD: VN-101"
              />
            </div>
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 text-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 text-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Trạng thái vận hành *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 font-medium text-neutral-800"
              >
                <option value="Chuẩn bị">Chuẩn bị</option>
                <option value="Đang vận hành">Đang vận hành</option>
                <option value="Hoàn thành">Hoàn thành</option>
              </select>
            </div>
          </div>

          {dateError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
              {dateError}
            </div>
          )}

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                <span>Điểm khởi hành</span>
              </label>
              <PlaceAutocompleteInput
                value={originFull}
                onChangeText={setOriginFull}
                coordinates={originCoords}
                onChangeCoordinates={setOriginCoords}
                placeholder="Đà Nẵng"
                inputClassName="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 text-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
                <span>Điểm đến chính</span>
              </label>
              <PlaceAutocompleteInput
                value={destinationFull}
                onChangeText={setDestinationFull}
                coordinates={destinationCoords}
                onChangeCoordinates={setDestinationCoords}
                placeholder="Huế"
                inputClassName="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 text-neutral-800"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              <span>Tổng ngân sách dự trù (VNĐ) *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={1}
                required
                value={budgetTotalInput}
                onChange={(e) => {
                  setBudgetTotalInput(e.target.value);
                  setBudgetError(null);
                }}
                className="w-full px-3 py-2 pr-14 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 font-mono font-bold text-neutral-950"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500 pointer-events-none">
                VNĐ
              </span>
            </div>
            {budgetError && (
              <p className="mt-1 text-[11px] font-semibold text-red-600">{budgetError}</p>
            )}
          </div>

          {/* Vehicle & Driver */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Phương tiện & Tài xế phụ trách</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Loại xe</label>
                <input
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:border-blue-600"
                  placeholder="VD: Xe 29 chỗ"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Tên tài xế</label>
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:border-blue-600"
                  placeholder="Chưa phân công"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">SĐT tài xế</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:border-blue-600"
                  placeholder="VD: 09xx xxx xxx"
                />
              </div>
            </div>
          </div>

          {truncateWarning && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-300 px-3 py-2 text-xs font-semibold text-red-800">
              {truncateWarning}
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-900/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : truncateWarning ? 'Xác nhận lưu thay đổi' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
