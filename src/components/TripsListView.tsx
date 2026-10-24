/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, MapPin, Sparkles, Edit2, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { TripData } from '../types/travel';

interface TripsListViewProps {
  trips: TripData[];
  currentTrip: TripData;
  onSelectTrip: (trip: TripData) => void;
  onOpenCreateModal: () => void;
  onEditTrip?: (trip: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const TripsListView: React.FC<TripsListViewProps> = ({
  trips,
  currentTrip,
  onSelectTrip,
  onOpenCreateModal,
  onEditTrip,
  onDeleteTrip,
  readOnly = false,
  isAdmin = false,
  searchQuery = '',
  onClearSearch,
}) => {
  const [tripToDelete, setTripToDelete] = useState<TripData | null>(null);
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const filteredTrips = trips.filter((trip) => {
    if (!normalizedQuery) return true;
    return (
      trip.title.toLowerCase().includes(normalizedQuery) ||
      trip.code.toLowerCase().includes(normalizedQuery) ||
      trip.originFull.toLowerCase().includes(normalizedQuery) ||
      trip.destinationFull.toLowerCase().includes(normalizedQuery) ||
      trip.status.toLowerCase().includes(normalizedQuery)
    );
  });

  const confirmDelete = () => {
    if (tripToDelete && onDeleteTrip) {
      onDeleteTrip(tripToDelete.id);
      setTripToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Danh mục Chuyến đi Điều phối</h2>
          <p className="text-xs text-slate-500 font-medium">
            {trips.length} chuyến đi đang lưu trong hệ thống • Quản lý, chỉnh sửa và điều phối lịch trình
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-900/20 transition active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAdmin ? 'Tạo tour cùng Gemini AI' : 'Tạo tour mới'}</span>
          </button>
        )}
      </div>

      {normalizedQuery && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <span>Tìm kiếm chuyến đi theo: <strong>&quot;{searchQuery}&quot;</strong> ({filteredTrips.length} kết quả)</span>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="font-bold text-amber-800 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTrips.map((trip) => {
          const isCurrent = trip.id === currentTrip.id;
          const route = `${trip.originFull} → ${trip.destinationFull}`;
          const budget = `${(trip.budgetTotal / 1_000_000).toLocaleString('vi-VN')} triệu`;
          return (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                isCurrent
                  ? 'bg-white border-2 border-teal-500 shadow-md ring-4 ring-teal-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      {trip.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        trip.status === 'Đang vận hành'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {trip.status}
                    </span>
                  </div>

                  {/* Actions: Edit & Delete buttons */}
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                      {onEditTrip && (
                        <button
                          type="button"
                          title="Sửa thông tin chuyến đi"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTrip(trip);
                          }}
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteTrip && (
                        <button
                          type="button"
                          title="Xóa chuyến đi"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTripToDelete(trip);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 mb-1 group-hover:text-teal-800 transition">
                  {trip.title}
                </h3>
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{route}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {trip.dates}
                </span>
                <span className="font-bold text-slate-800">
                  {budget} • {trip.membersTotal} khách
                </span>
              </div>
            </div>
          );
        })}

        {trips.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Chưa có chuyến đi nào được lưu.
          </p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Xác nhận xóa chuyến đi?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa chuyến đi <strong>&quot;{tripToDelete.title}&quot;</strong> (Mã: {tripToDelete.code})? Hành động này sẽ xóa toàn bộ lịch trình, thành viên và cảnh báo của chuyến đi này và không thể hoàn tác.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTripToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-900/20 transition"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
