import React from 'react';
import { Calendar, Wallet, CheckCircle2, Bus } from 'lucide-react';
import { TripData } from '../types/travel';

interface MetricCardsProps {
  trip: TripData;
  onOpenMembers: () => void;
  onOpenBudget: () => void;
  onOpenSchedule: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  trip,
  onOpenMembers,
  onOpenBudget,
  onOpenSchedule,
}) => {
  const formatMillions = (amount: number) => {
    if (!amount) return '0 ₫';
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')} triệu`;
    }
    return `${amount.toLocaleString('vi-VN')} ₫`;
  };

  const formatShortMillions = (amount: number) => {
    if (!amount) return '0đ';
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')}tr`;
    }
    return `${amount.toLocaleString('vi-VN')}đ`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Tuyến đang điều phối */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
            <div className="flex items-center gap-1.5 text-teal-700 font-bold">
              <svg className="w-4 h-4 text-teal-600 fill-none stroke-[2] stroke-current" viewBox="0 0 24 24">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              <span>Tuyến đang điều phối</span>
            </div>
            <span className="text-slate-400 font-medium text-[11px]">{trip.dates}</span>
          </div>

          {/* Route Graphics */}
          <div className="flex items-center justify-between my-2">
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">{trip.origin}</div>
              <div className="text-xs text-slate-400 font-medium">{trip.originFull}</div>
            </div>

            {/* Connecting Bus Badge */}
            <div className="flex-1 px-4 flex items-center">
              <div className="w-full border-t-2 border-dashed border-slate-300 relative flex items-center justify-center">
                <div className="absolute w-7 h-7 rounded-full bg-teal-50 border border-teal-300 text-teal-700 flex items-center justify-center shadow-xs">
                  <Bus className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 tracking-tight">{trip.destination}</div>
              <div className="text-xs text-slate-400 font-medium">{trip.destinationFull}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="truncate">
            {trip.destinationsCount} điểm đến • {trip.totalKm} km • {trip.vehicle}
          </span>
          <span className="font-bold text-slate-800 ml-2 shrink-0">
            Ngày {trip.currentDay} / {trip.totalDays}
          </span>
        </div>
      </div>

      {/* Card 2: Lịch trình */}
      <div
        onClick={onOpenSchedule}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Lịch trình</span>
          </div>

          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {trip.totalActivities} hoạt động
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              <span className="text-emerald-600 font-semibold">{trip.confirmedActivities} đã xác nhận</span> • {trip.pendingActivities} chờ
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Tiến độ hành trình</span>
          <span className="font-semibold text-blue-600">88.8% sẵn sàng</span>
        </div>
      </div>

      {/* Card 3: Ngân sách */}
      <div
        onClick={onOpenBudget}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Ngân sách</span>
          </div>

          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatMillions(trip.budgetTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Đã dùng <span className="font-semibold text-slate-700">{trip.budgetUsedPercent}%</span> • còn {formatShortMillions(trip.budgetRemaining)}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${trip.budgetUsedPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Card 4: Thành viên */}
      <div
        onClick={onOpenMembers}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
      >
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>THÀNH VIÊN</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {trip.membersOnline}/{trip.membersTotal} online
            </span>
          </div>

          {/* Member Avatars */}
          <div className="flex items-center -space-x-2 my-2 py-1">
            {trip.members.slice(0, 5).map((member) => (
              <div
                key={member.id}
                title={`${member.name} (${member.role})`}
                className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white text-slate-700 font-bold text-xs flex items-center justify-center shadow-xs hover:translate-y-[-2px] transition-transform"
              >
                {member.avatar}
              </div>
            ))}
            {trip.members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white text-slate-600 font-bold text-xs flex items-center justify-center shadow-xs">
                +{trip.members.length - 5}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{trip.membersStatus}</span>
        </div>
      </div>
    </div>
  );
};
