import React from 'react';
import { AlertTriangle, Search, X, EyeOff, Eye, Edit2, Trash2 } from 'lucide-react';
import type { Waypoint } from './planningDataTypes';

interface LocationsTabProps {
  activeSubTab: string;
  totalInvalidCount: number;
  filterInvalidOnly: boolean;
  setFilterInvalidOnly: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  categoryFilter: string;
  setCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  filteredLocations: Waypoint[];
  checkDataValidation: (waypoint: Waypoint) => string[];
  handleToggleHide: (id: string) => Promise<void>;
  setEditingWaypoint: React.Dispatch<React.SetStateAction<Waypoint | null>>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteLocation: (id: string, name: string) => Promise<void>;
}

export const LocationsTab: React.FC<LocationsTabProps> = (props) => {
  const { activeSubTab, totalInvalidCount, filterInvalidOnly, setFilterInvalidOnly, searchQuery, setSearchQuery, categoryFilter, setCategoryFilter, filteredLocations, checkDataValidation, handleToggleHide, setEditingWaypoint, confirmDeleteId, setConfirmDeleteId, handleDeleteLocation } = props;
  return (
    <>
      {activeSubTab === 'locations' && (
        <div className="space-y-4">
          {/* Cảnh báo Dữ liệu Thiếu / Lỗi nếu có */}
          {totalInvalidCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <strong>Phát hiện {totalInvalidCount} địa điểm có dữ liệu chưa hoàn thiện!</strong>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Tọa độ ngoài phạm vi Việt Nam hoặc thiếu giờ mở cửa / giá vé có thể khiến AI ước lượng lịch trình thiếu chính xác.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilterInvalidOnly(!filterInvalidOnly)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  filterInvalidOnly ? 'bg-amber-500 text-slate-900' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'
                }`}
              >
                {filterInvalidOnly ? 'Xem tất cả' : 'Lọc điểm cần sửa'}
              </button>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm địa điểm theo tên hoặc mã..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Phân loại Type Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Tất cả loại hình' },
                { id: 'nature', label: '🌿 Thiên nhiên' },
                { id: 'food', label: '🍜 Ăn uống' },
                { id: 'entertainment', label: '🎡 Vui chơi' },
                { id: 'culture', label: '🏛️ Văn hóa' },
                { id: 'stay', label: '🏨 Lưu trú' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    categoryFilter === c.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Locations */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLocations.map((wp) => {
              const issues = checkDataValidation(wp);
              const hasIssues = issues.length > 0;
              const catLabels: Record<string, string> = {
                nature: 'Thiên nhiên',
                food: 'Ăn uống',
                entertainment: 'Vui chơi',
                culture: 'Văn hóa',
                stay: 'Lưu trú',
              };

              return (
                <div
                  key={wp.id}
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-3 ${
                    wp.isHidden
                      ? 'border-slate-800 bg-slate-900/50 opacity-60'
                      : hasIssues
                      ? 'border-amber-500/40 bg-slate-900/90 shadow-amber-950/20'
                      : 'border-slate-800 bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-teal-400">{wp.code}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {catLabels[wp.category || 'culture'] || wp.category}
                        </span>
                        {wp.isHidden && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-white text-base mt-1">{wp.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Tọa độ: {wp.lat}, {wp.lng}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleHide(wp.id)}
                        title={wp.isHidden ? 'Hiển thị lại địa điểm' : 'Ẩn địa điểm khỏi gợi ý'}
                        className={`p-1.5 rounded-lg border transition ${
                          wp.isHidden ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-800 text-teal-400 border-teal-500/30'
                        }`}
                      >
                        {wp.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingWaypoint(wp)}
                        title="Chỉnh sửa thông tin"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === wp.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void handleDeleteLocation(wp.id, wp.name)}
                            className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition"
                          >
                            Xóa
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold transition"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(wp.id)}
                          title="Xóa địa điểm"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
                    <div className="rounded-xl bg-slate-800/60 p-2">
                      <span className="text-[10px] text-slate-400 block">Giờ mở cửa</span>
                      <strong className="text-slate-200">{wp.openHours || 'Chưa cập nhật'}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2">
                      <span className="text-[10px] text-slate-400 block">Giá vé tham khảo</span>
                      <strong className="text-amber-300">{wp.ticketPrice || 'Miễn phí'}</strong>
                    </div>
                  </div>

                  {wp.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{wp.description}</p>
                  )}

                  {/* Cảnh báo lỗi dữ liệu */}
                  {hasIssues && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-300 space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-[10px] uppercase">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Cần bổ sung:
                      </div>
                      {issues.map((iss, i) => (
                        <div key={i} className="text-slate-300 text-[10px]">• {iss}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
