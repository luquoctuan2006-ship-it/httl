import React from 'react';
import { Calendar, Wallet, Users, MapPin } from 'lucide-react';
import { TripData } from '../../types/travel';

interface MetricCardsProps {
  trip: TripData;
  onOpenMembers: () => void;
  onOpenBudget: () => void;
  onOpenSchedule: () => void;
  onOpenMap?: () => void;
  hideBudgetCard?: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  trip,
  onOpenMembers,
  onOpenBudget,
  onOpenSchedule,
  onOpenMap,
  hideBudgetCard = false,
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

  const allActs = (trip.days || []).flatMap((d) => d.activities || []);
  const hasActivitiesArray = allActs.length > 0;
  const totalCount = hasActivitiesArray ? allActs.length : trip.totalActivities;
  const confirmedCount = hasActivitiesArray
    ? allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length
    : trip.confirmedActivities;
  const pendingCount = hasActivitiesArray
    ? allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length
    : trip.pendingActivities;
  const completedCount = hasActivitiesArray
    ? allActs.filter((a) => a.status === 'Hoàn tất').length
    : 0;
  const completedPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const hasBudget = trip.budgetTotal > 0;
  const rawBudgetPercent = hasBudget ? Math.round((trip.budgetUsed / trip.budgetTotal) * 100) : trip.budgetUsedPercent;
  const isOver = hasBudget && trip.budgetUsed > trip.budgetTotal;
  const isNear = hasBudget && !isOver && trip.budgetUsed >= trip.budgetTotal * 0.85;
  const overAmount = Math.max(0, trip.budgetUsed - trip.budgetTotal);

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${hideBudgetCard ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
      {/* Card 1: Tuyến hành trình */}
      <button
        type="button"
        onClick={onOpenMap}
        disabled={!onOpenMap}
        className={`text-left bg-white rounded-xl p-4 sm:p-5 border border-neutral-200 transition flex flex-col justify-between ${
          onOpenMap ? 'hover:border-blue-500 cursor-pointer' : ''
        }`}
      >
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span className="font-medium inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              Tuyến hành trình
            </span>
            <span className="tabular-nums text-[11px] font-mono">{trip.totalKm} km</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight truncate">
            {trip.origin || trip.originFull} → {trip.destination || trip.destinationFull}
          </div>
          <div className="text-xs text-neutral-500 mt-1 truncate">
            {trip.originFull} đến {trip.destinationFull}
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 tabular-nums">
          <span className="truncate">{trip.destinationsCount} điểm dừng · {trip.vehicle}</span>
          <span className="font-semibold text-neutral-950 shrink-0 ml-2">
            Ngày {trip.currentDay}/{trip.totalDays}
          </span>
        </div>
      </button>

      {/* Card 2: Lịch trình */}
      <button
        type="button"
        onClick={onOpenSchedule}
        className="text-left bg-white rounded-xl p-4 sm:p-5 border border-neutral-200 hover:border-blue-500 transition flex flex-col justify-between cursor-pointer"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span className="font-medium inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Lịch trình
            </span>
            <span className="tabular-nums text-[11px] font-semibold text-blue-700">
              {completedPercent}% hoàn tất
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight tabular-nums">
            {totalCount} hoạt động
          </div>
          <div className="text-xs text-neutral-500 mt-1 tabular-nums">
            {confirmedCount} đã xác nhận · {pendingCount} chờ xử lý
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 tabular-nums">
          <span>Đã hoàn thành</span>
          <span className="font-semibold text-neutral-950">
            {completedCount}/{totalCount} mục
          </span>
        </div>
      </button>

      {/* Card 3: Ngân sách (chỉ hiển thị cho chủ chuyến) */}
      {!hideBudgetCard && (
        <button
          type="button"
          onClick={onOpenBudget}
          className={`text-left rounded-xl p-4 sm:p-5 border transition flex flex-col justify-between cursor-pointer ${
            isOver
              ? 'bg-red-50/50 border-red-300 hover:border-red-500'
              : isNear
                ? 'bg-red-50/20 border-red-200 hover:border-red-400'
                : 'bg-white border-neutral-200 hover:border-blue-500'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
              <span className="font-medium inline-flex items-center gap-1.5">
                <Wallet className={`w-3.5 h-3.5 ${isOver || isNear ? 'text-red-600' : 'text-blue-600'}`} />
                Ngân sách
              </span>
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  isOver ? 'text-red-700' : isNear ? 'text-red-600' : 'text-neutral-600'
                }`}
              >
                {isOver ? 'Vượt mức' : isNear ? 'Gần chạm mức (≥85%)' : `${rawBudgetPercent}% đã dùng`}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight tabular-nums">
              {formatMillions(trip.budgetTotal)}
            </div>
            <div className="text-xs text-neutral-500 mt-1 tabular-nums">
              {isOver ? (
                <span className="font-semibold text-red-700">Vượt {formatShortMillions(overAmount)}</span>
              ) : (
                <span>Còn lại {formatShortMillions(trip.budgetRemaining)}</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-100">
            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOver || isNear ? 'bg-red-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(rawBudgetPercent, 100)}%` }}
              />
            </div>
          </div>
        </button>
      )}

      {/* Card 4: Thành viên */}
      <button
        type="button"
        onClick={onOpenMembers}
        className="text-left bg-white rounded-xl p-4 sm:p-5 border border-neutral-200 hover:border-blue-500 transition flex flex-col justify-between cursor-pointer"
      >
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
            <span className="font-medium inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-neutral-900" />
              Đoàn &amp; Thành viên
            </span>
            <span className="tabular-nums text-[11px]">
              {trip.membersOnline}/{trip.membersTotal} trực tuyến
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight tabular-nums">
            {trip.membersTotal} thành viên
          </div>
          <div className="text-xs text-neutral-500 mt-1 tabular-nums truncate">
            {trip.membersStatus}
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Chi tiết điểm danh</span>
          <span className="font-semibold text-blue-600">Mở danh sách →</span>
        </div>
      </button>
    </div>
  );
};
