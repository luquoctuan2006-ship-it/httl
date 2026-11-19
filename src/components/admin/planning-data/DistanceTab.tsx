import React from 'react';
import { Navigation, Compass, ArrowRight } from 'lucide-react';
import type { Waypoint, CalculatedLeg, DistanceLeg } from './planningDataTypes';

interface DistanceTabProps {
  activeSubTab: string;
  totalCalculatedKm: number;
  totalCalculatedHours: string;
  calcOrigin: string;
  setCalcOrigin: React.Dispatch<React.SetStateAction<string>>;
  calcDest: string;
  setCalcDest: React.Dispatch<React.SetStateAction<string>>;
  locations: Waypoint[];
  calculatedLeg: CalculatedLeg | null;
  dynamicDistanceMatrix: DistanceLeg[];
}

export const DistanceTab: React.FC<DistanceTabProps> = (props) => {
  const { activeSubTab, totalCalculatedKm, totalCalculatedHours, calcOrigin, setCalcOrigin, calcDest, setCalcDest, locations, calculatedLeg, dynamicDistanceMatrix } = props;
  return (
    <>
      {activeSubTab === 'distance' && (
        <div className="space-y-4">
          {/* Trip Route Overview Card */}
          <div className="rounded-2xl border border-neutral-800 bg-[#090B11] p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/35 flex items-center justify-center text-blue-400 shrink-0">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Tổng quan Tuyến đường Tour Hiện tại</h3>
                <p className="text-xs text-neutral-400">
                  Cự ly và thời gian được tính toán chuẩn xác theo tọa độ GPS và hệ số uốn lượn đường sá Việt Nam (1.35x).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-xl bg-neutral-900 px-4 py-2 text-center border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block font-bold">Tổng cự ly</span>
                <span className="text-sm font-black text-blue-300 tabular-nums">{totalCalculatedKm} km</span>
              </div>
              <div className="rounded-xl bg-neutral-900 px-4 py-2 text-center border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block font-bold">Thời gian chạy xe</span>
                <span className="text-sm font-black text-red-300 tabular-nums">{totalCalculatedHours}</span>
              </div>
            </div>
          </div>

          {/* Interactive Point-to-Point Distance Calculator */}
          <div className="rounded-2xl border border-neutral-800 bg-[#090B11] p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2.5 flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-400" />
              Tra cứu Ma trận Cự ly & Thời gian Tức thì Giữa 2 Điểm
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5">
                <label className="text-[10px] text-neutral-400 font-bold block mb-1">Điểm xuất phát (A)</label>
                <select
                  value={calcOrigin}
                  onChange={(e) => setCalcOrigin(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn điểm xuất phát --</option>
                  {locations.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.code} - {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 flex justify-center pt-3 sm:pt-4">
                <ArrowRight className="w-5 h-5 text-blue-400" />
              </div>

              <div className="sm:col-span-5">
                <label className="text-[10px] text-neutral-400 font-bold block mb-1">Điểm đến (B)</label>
                <select
                  value={calcDest}
                  onChange={(e) => setCalcDest(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn điểm đến --</option>
                  {locations.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.code} - {wp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {calculatedLeg && (
              <div className="mt-3 p-3 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between text-xs animate-fade-in">
                <div className="text-neutral-200">
                  <strong className="text-white">{calculatedLeg.from}</strong> <span className="text-blue-400">➔</span> <strong className="text-white">{calculatedLeg.to}</strong>
                </div>
                <div className="flex items-center gap-4 font-bold">
                  <span className="text-blue-300 font-mono tabular-nums">Cự ly: {calculatedLeg.distance}</span>
                  <span className="text-red-300 font-mono tabular-nums">Dự kiến: {calculatedLeg.estTime}</span>
                </div>
              </div>
            )}
          </div>

          {/* Consecutive Leg Table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#090B11] shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-neutral-900 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <span className="col-span-4">Chặng xuất phát ➔ Điểm đến</span>
              <span className="col-span-2">Cự ly chuẩn</span>
              <span className="col-span-2">Thời gian ước tính</span>
              <span className="col-span-4">Tuyến đường huyết mạch</span>
            </div>
            <div className="divide-y divide-neutral-800/80">
              {dynamicDistanceMatrix.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  Cần ít nhất 2 địa điểm trong cơ sở dữ liệu để tự động sinh ma trận khoảng cách chặng.
                </div>
              ) : (
                dynamicDistanceMatrix.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-neutral-900/70 transition">
                    <span className="col-span-4 font-bold text-white">
                      {item.from} <span className="text-blue-400 font-normal">➔</span> {item.to}
                    </span>
                    <span className="col-span-2 font-mono font-bold text-blue-300 tabular-nums">{item.distance}</span>
                    <span className="col-span-2 font-bold text-red-300 tabular-nums">{item.estTime}</span>
                    <span className="col-span-4 text-neutral-400">{item.road}</span>
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
