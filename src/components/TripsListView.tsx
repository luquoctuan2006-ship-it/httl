/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Calendar, MapPin, Sparkles, Edit2, Trash2, AlertTriangle, Copy, ArrowUpDown, Filter } from 'lucide-react';
import { TripData } from '../types/travel';

interface TripsListViewProps {
  trips: TripData[];
  currentTrip: TripData | null;
  onSelectTrip: (trip: TripData) => void;
  onOpenCreateModal: () => void;
  onEditTrip?: (trip: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  onCloneTrip?: (trip: TripData) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

type StatusFilter = 'all' | TripData['status'];
type SortMode = 'recent' | 'title_asc' | 'budget_desc' | 'days_desc';

export const TripsListView: React.FC<TripsListViewProps> = ({
  trips,
  currentTrip,
  onSelectTrip,
  onOpenCreateModal,
  onEditTrip,
  onDeleteTrip,
  onCloneTrip,
  readOnly = false,
  isAdmin = false,
  searchQuery = '',
  onClearSearch,
}) => {
  const [tripToDelete, setTripToDelete] = useState<TripData | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: trips.length,
      'Chuẩn bị': 0,
      'Đang vận hành': 0,
      'Hoàn thành': 0,
    };
    for (const t of trips) {
      if (t.status in counts) {
        counts[t.status] += 1;
      }
    }
    return counts;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const matched = trips.filter((trip) => {
      if (statusFilter !== 'all' && trip.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return (
        trip.title.toLowerCase().includes(normalizedQuery) ||
        trip.code.toLowerCase().includes(normalizedQuery) ||
        trip.originFull.toLowerCase().includes(normalizedQuery) ||
        trip.destinationFull.toLowerCase().includes(normalizedQuery) ||
        trip.status.toLowerCase().includes(normalizedQuery)
      );
    });

    if (sortMode === 'title_asc') {
      return [...matched].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    }
    if (sortMode === 'budget_desc') {
      return [...matched].sort((a, b) => (b.budgetTotal || 0) - (a.budgetTotal || 0));
    }
    if (sortMode === 'days_desc') {
      return [...matched].sort((a, b) => (b.totalDays || 0) - (a.totalDays || 0));
    }
    return matched;
  }, [trips, statusFilter, normalizedQuery, sortMode]);

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
            {trips.length} chuyến đi đang lưu trong hệ thống • Quản lý, lọc, nhân bản làm mẫu và điều phối lịch trình
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

      {/* Bộ lọc trạng thái & Sắp xếp */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Trạng thái:
          </span>
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'Đang vận hành', label: 'Đang vận hành' },
              { id: 'Chuẩn bị', label: 'Chuẩn bị' },
              { id: 'Hoàn thành', label: 'Hoàn thành' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === item.id
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label} ({statusCounts[item.id]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <label className="font-semibold text-slate-500">Sắp xếp:</label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none focus:border-teal-500"
          >
            <option value="recent">Mới cập nhật</option>
            <option value="title_asc">Tên tour (A → Z)</option>
            <option value="budget_desc">Ngân sách cao nhất</option>
            <option value="days_desc">Số ngày dài nhất</option>
          </select>
        </div>
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
          const isCurrent = currentTrip?.id === trip.id;
          const route = `${trip.originFull} → ${trip.destinationFull}`;
          const budget = `${((trip.budgetTotal || 0) / 1_000_000).toLocaleString('vi-VN')} triệu`;
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
                          : trip.status === 'Hoàn thành'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {trip.status}
                    </span>
                  </div>

                  {/* Actions: Clone, Edit & Delete buttons */}
                  {!readOnly && (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                      {onCloneTrip && (
                        <button
                          type="button"
                          title="Nhân bản làm tour mẫu mới"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloneTrip(trip);
                          }}
                          className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  <span className="truncate">{route || 'Chưa cập nhật tuyến đường'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {trip.dates || `${trip.totalDays} ngày`}
                </span>
                <span className="font-bold text-slate-800">
                  {budget} • {trip.membersTotal} khách
                </span>
              </div>
            </div>
          );
        })}

        {filteredTrips.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
            <p className="text-sm text-slate-500 font-medium">
              {trips.length === 0
                ? 'Bạn chưa có chuyến đi nào. Hãy tạo chuyến đi đầu tiên để bắt đầu điều phối!'
                : 'Không có chuyến đi nào khớp với bộ lọc hiện tại.'}
            </p>
            {trips.length === 0 && !readOnly && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tạo chuyến đi đầu tiên</span>
              </button>
            )}
          </div>
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
