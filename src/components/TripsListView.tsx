import React from 'react';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { TripData } from '../types/travel';

interface TripsListViewProps {
  trips: TripData[];
  currentTrip: TripData;
  onSelectTrip: (trip: TripData) => void;
  onOpenCreateModal: () => void;
  readOnly?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const TripsListView: React.FC<TripsListViewProps> = ({
  trips,
  currentTrip,
  onSelectTrip,
  onOpenCreateModal,
  readOnly = false,
  searchQuery = '',
  onClearSearch,
}) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Danh mục Chuyến đi Điều phối</h2>
          <p className="text-xs text-slate-500 font-medium">
            {trips.length} chuyến đi đang lưu trong hệ thống
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo chuyến đi cùng Gemini AI</span>
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
              className="font-bold text-amber-800 hover:underline"
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
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isCurrent
                  ? 'bg-white border-2 border-teal-500 shadow-md ring-4 ring-teal-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
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

                <h3 className="text-base font-extrabold text-slate-900 mb-1">
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
    </div>
  );
};
