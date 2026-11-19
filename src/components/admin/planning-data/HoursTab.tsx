import React from 'react';
import { Edit2 } from 'lucide-react';
import type { Waypoint, OperatingHoursItem } from './planningDataTypes';

interface HoursTabProps {
  activeSubTab: string;
  locations: Waypoint[];
  dynamicOperatingHours: OperatingHoursItem[];
  setEditingWaypoint: React.Dispatch<React.SetStateAction<Waypoint | null>>;
}

export const HoursTab: React.FC<HoursTabProps> = (props) => {
  const { activeSubTab, locations, dynamicOperatingHours, setEditingWaypoint } = props;
  return (
    <>
      {activeSubTab === 'hours' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-[#090B11] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Tổng điểm tham quan</span>
              <span className="text-xl font-black text-white tabular-nums">{locations.length} điểm</span>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#090B11] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">Mở cửa sớm (≤ 07:30)</span>
              <span className="text-xl font-black text-blue-300 tabular-nums">
                {dynamicOperatingHours.filter((h) => h.open <= '07:30').length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#090B11] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">Mở tối muộn / 24h</span>
              <span className="text-xl font-black text-red-300 tabular-nums">
                {dynamicOperatingHours.filter((h) => h.close >= '20:00' || h.openHours.includes('24')).length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#090B11] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">Miễn phí vé</span>
              <span className="text-xl font-black text-white tabular-nums">
                {dynamicOperatingHours.filter((h) => h.ticketPrice === 'Miễn phí' || h.ticketPrice.includes('0')).length} điểm
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#090B11] shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-neutral-900 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <span className="col-span-4">Điểm tham quan & Danh mục</span>
              <span className="col-span-3">Giờ mở / Đóng cửa</span>
              <span className="col-span-2">Thời lượng khuyến nghị</span>
              <span className="col-span-2">Ghi chú điều phối</span>
              <span className="col-span-1 text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-neutral-800/80">
              {dynamicOperatingHours.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  Chưa có địa điểm nào trong cơ sở dữ liệu. Vui lòng thêm điểm ở Tab 1.
                </div>
              ) : (
                dynamicOperatingHours.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-neutral-900/70 transition">
                    <div className="col-span-4 flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 shrink-0 tabular-nums">
                        {item.code}
                      </span>
                      <div>
                        <strong className="font-bold text-white text-sm block">{item.place}</strong>
                        <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">
                          {item.category === 'nature' ? '🌿 Thiên nhiên' : item.category === 'culture' ? '🏛️ Văn hóa' : item.category === 'entertainment' ? '🎡 Vui chơi' : item.category === 'food' ? '🍜 Ăn uống' : '🏨 Lưu trú'}
                        </span>
                      </div>
                    </div>
                    <span className="col-span-3 text-blue-300 font-mono font-bold tabular-nums">
                      {item.openHours}
                    </span>
                    <span className="col-span-2 text-red-300 font-bold tabular-nums">{item.duration}</span>
                    <span className="col-span-2 text-neutral-400 truncate" title={item.note}>{item.note}</span>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setEditingWaypoint(item.rawWaypoint)}
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-blue-400 border border-neutral-800 transition"
                        title="Chỉnh sửa giờ & thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
