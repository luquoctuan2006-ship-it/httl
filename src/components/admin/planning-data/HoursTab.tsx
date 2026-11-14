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
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tổng điểm tham quan</span>
              <span className="text-xl font-black text-white">{locations.length} điểm</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Mở cửa sớm (≤ 07:30)</span>
              <span className="text-xl font-black text-teal-300">
                {dynamicOperatingHours.filter((h) => h.open <= '07:30').length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Mở tối muộn / 24h</span>
              <span className="text-xl font-black text-amber-300">
                {dynamicOperatingHours.filter((h) => h.close >= '20:00' || h.openHours.includes('24')).length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Miễn phí vé</span>
              <span className="text-xl font-black text-sky-300">
                {dynamicOperatingHours.filter((h) => h.ticketPrice === 'Miễn phí' || h.ticketPrice.includes('0')).length} điểm
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <span className="col-span-4">Điểm tham quan & Danh mục</span>
              <span className="col-span-3">Giờ mở / Đóng cửa</span>
              <span className="col-span-2">Thời lượng khuyến nghị</span>
              <span className="col-span-2">Ghi chú điều phối</span>
              <span className="col-span-1 text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {dynamicOperatingHours.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có địa điểm nào trong cơ sở dữ liệu. Vui lòng thêm điểm ở Tab 1.
                </div>
              ) : (
                dynamicOperatingHours.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-slate-800/30 transition">
                    <div className="col-span-4 flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        {item.code}
                      </span>
                      <div>
                        <strong className="font-bold text-white text-sm block">{item.place}</strong>
                        <span className="text-[10px] text-teal-400 uppercase font-bold tracking-wider">
                          {item.category === 'nature' ? '🌿 Thiên nhiên' : item.category === 'culture' ? '🏛️ Văn hóa' : item.category === 'entertainment' ? '🎡 Vui chơi' : item.category === 'food' ? '🍜 Ăn uống' : '🏨 Lưu trú'}
                        </span>
                      </div>
                    </div>
                    <span className="col-span-3 text-teal-300 font-mono font-bold">
                      {item.openHours}
                    </span>
                    <span className="col-span-2 text-amber-300 font-bold">{item.duration}</span>
                    <span className="col-span-2 text-slate-400 truncate" title={item.note}>{item.note}</span>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setEditingWaypoint(item.rawWaypoint)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
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
