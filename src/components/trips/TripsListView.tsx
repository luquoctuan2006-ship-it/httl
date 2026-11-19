/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Calendar, MapPin, Sparkles, Edit2, Trash2, AlertTriangle, Copy, ArrowUpDown, Filter, KeyRound } from 'lucide-react';
import { TripData } from '../../types/travel';
import { isUserTripOwnerOrAdmin } from '../../utils/trip/tripJoinHelpers';

interface TripsListViewProps {
  trips: TripData[];
  currentTrip: TripData | null;
  onSelectTrip: (trip: TripData) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal?: () => void;
  onEditTrip?: (trip: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  onCloneTrip?: (trip: TripData) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  currentUserUid?: string;
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
  onOpenJoinModal,
  onEditTrip,
  onDeleteTrip,
  onCloneTrip,
  readOnly = false,
  isAdmin = false,
  currentUserUid,
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

  const hasAnyOwnedTrip = useMemo(
    () =>
      trips.some((t) =>
        isUserTripOwnerOrAdmin(t, currentUserUid, isAdmin ? 'admin' : 'user'),
      ),
    [trips, currentUserUid, isAdmin],
  );

  const effectiveSortMode: SortMode =
    sortMode === 'budget_desc' && !hasAnyOwnedTrip ? 'recent' : sortMode;

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

    if (effectiveSortMode === 'title_asc') {
      return [...matched].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    }
    if (effectiveSortMode === 'budget_desc') {
      return [...matched].sort((a, b) => (b.budgetTotal || 0) - (a.budgetTotal || 0));
    }
    if (effectiveSortMode === 'days_desc') {
      return [...matched].sort((a, b) => (b.totalDays || 0) - (a.totalDays || 0));
    }
    return matched;
  }, [trips, statusFilter, normalizedQuery, effectiveSortMode]);

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
          <h2 className={`text-xl font-black ${isAdmin ? 'text-white' : 'text-neutral-950'}`}>Danh sách Chuyến đi</h2>
          <p className={`text-xs font-medium ${isAdmin ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {trips.length} chuyến đi đang lưu trong hệ thống · Quản lý, lọc, nhân bản làm mẫu và sắp xếp lịch trình
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenJoinModal && (
              <button
                type="button"
                onClick={onOpenJoinModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300 hover:border-blue-500 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Tham gia bằng mã</span>
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-900/20 transition active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAdmin ? 'Tạo tour tự động' : 'Tạo tour mới'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bộ lọc trạng thái & Sắp xếp */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1 mr-1">
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
                  ? item.id === 'Đang vận hành'
                    ? 'bg-red-600 text-white shadow-xs'
                    : item.id === 'Hoàn thành'
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {item.label} ({statusCounts[item.id]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
          <label className="font-semibold text-neutral-500">Sắp xếp:</label>
          <select
            value={effectiveSortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 font-bold outline-none focus:border-blue-600"
          >
            <option value="recent">Mới cập nhật</option>
            <option value="title_asc">Tên tour (A → Z)</option>
            {hasAnyOwnedTrip && <option value="budget_desc">Ngân sách cao nhất</option>}
            <option value="days_desc">Số ngày dài nhất</option>
          </select>
        </div>
      </div>

      {normalizedQuery && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-950">
          <span>Tìm kiếm chuyến đi theo: <strong>&quot;{searchQuery}&quot;</strong> ({filteredTrips.length} kết quả)</span>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="font-bold text-blue-700 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTrips.map((trip) => {
          const isCurrent = currentTrip?.id === trip.id;
          const isOwnerOrAdmin = isUserTripOwnerOrAdmin(trip, currentUserUid, isAdmin ? 'admin' : 'user');
          const route = `${trip.originFull} → ${trip.destinationFull}`;
          const budget = `${((trip.budgetTotal || 0) / 1_000_000).toLocaleString('vi-VN')} triệu`;
          return (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                isCurrent
                  ? 'bg-white border-2 border-blue-600 shadow-md ring-4 ring-blue-600/10'
                  : 'bg-white border-neutral-200 hover:border-blue-400 shadow-2xs hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {trip.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        trip.status === 'Đang vận hành'
                          ? 'text-red-600'
                          : trip.status === 'Hoàn thành'
                            ? 'text-neutral-900'
                            : 'text-blue-700'
                      }`}
                    >
                      · {trip.status}
                    </span>
                    {!isOwnerOrAdmin && (
                      <span className="text-[11px] font-bold text-neutral-600">
                        · Hành khách
                      </span>
                    )}
                  </div>

                  {/* Actions: Clone, Edit & Delete buttons (Edit & Delete only for Owner/Admin) */}
                  {!readOnly && (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition shrink-0">
                      {onCloneTrip && isOwnerOrAdmin && (
                        <button
                          type="button"
                          title="Nhân bản làm tour mẫu mới"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloneTrip(trip);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onEditTrip && isOwnerOrAdmin && (
                        <button
                          type="button"
                          title="Sửa thông tin chuyến đi"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTrip(trip);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteTrip && isOwnerOrAdmin && (
                        <button
                          type="button"
                          title="Xóa chuyến đi"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTripToDelete(trip);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-neutral-950 mb-1 group-hover:text-blue-700 transition">
                  {trip.title}
                </h3>
                <div className="text-xs text-neutral-500 font-medium flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">{route || 'Chưa cập nhật tuyến đường'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 tabular-nums">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {trip.dates || `${trip.totalDays} ngày`}
                </span>
                <span className="font-bold text-neutral-900">
                  {isOwnerOrAdmin ? `${budget} · ` : ''}{trip.membersTotal} khách
                </span>
              </div>
            </div>
          );
        })}

        {filteredTrips.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center space-y-3">
            <p className="text-sm text-neutral-500 font-medium">
              {trips.length === 0
                ? 'Bạn chưa có chuyến đi nào. Hãy tạo chuyến đi đầu tiên hoặc nhập mã tham gia để vào đoàn!'
                : 'Không có chuyến đi nào khớp với bộ lọc hiện tại.'}
            </p>
            {trips.length === 0 && !readOnly && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onOpenJoinModal && (
                  <button
                    type="button"
                    onClick={onOpenJoinModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 hover:border-blue-500 text-neutral-900 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Tham gia bằng mã</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tạo chuyến đi đầu tiên</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-md w-full border border-neutral-200 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-neutral-950">Xác nhận xóa chuyến đi?</h3>
            <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa chuyến đi <strong>&quot;{tripToDelete.title}&quot;</strong> (Mã: {tripToDelete.code})? Hành động này sẽ xóa toàn bộ lịch trình, thành viên và cảnh báo của chuyến đi này và không thể hoàn tác.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTripToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-900/20 transition cursor-pointer"
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
