import React from 'react';
import { AlertCircle, AlertTriangle, Download, Edit3, Plus, Printer, Sliders } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import type { BudgetCategory } from './types';

interface BudgetSummaryProps {
  trip: TripData;
  totalBudget: number;
  totalAllocatedSum: number;
  spentBudget: number;
  actualSpentBudget?: number;
  plannedCommittedBudget?: number;
  pendingApprovalBudget?: number;
  pendingApprovalCount?: number;
  remainingBudget: number;
  overBudgetAmount: number;
  rawPercentUsed: number;
  isOverTotalBudget: boolean;
  isNearTotalBudget: boolean;
  activityCount: number;
  invoiceCount: number;
  invoiceLimitReached?: boolean;
  categories: BudgetCategory[];
  handleExportCsv: () => void;
  setIsReportPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenEditAllocations: () => void;
  onOpenEditBudget: () => void;
  openCreateInvoiceModal: () => void;
  isAdmin?: boolean;
}

export function BudgetSummary(props: BudgetSummaryProps) {
  const {
    trip,
    totalBudget,
    totalAllocatedSum,
    spentBudget,
    actualSpentBudget = 0,
    plannedCommittedBudget = 0,
    pendingApprovalBudget = 0,
    pendingApprovalCount = 0,
    remainingBudget,
    overBudgetAmount,
    rawPercentUsed,
    isOverTotalBudget,
    isNearTotalBudget,
    activityCount,
    invoiceCount,
    invoiceLimitReached = false,
    categories,
    handleExportCsv,
    setIsReportPreviewOpen,
    onOpenEditAllocations,
    onOpenEditBudget,
    openCreateInvoiceModal,
    isAdmin = false,
  } = props;

  const overCategories = categories.filter((c) => c.level === 'over');
  const nearCategories = categories.filter((c) => c.level === 'near');
  const hasAnyOver = isOverTotalBudget || overCategories.length > 0;
  const hasAnyNear = !hasAnyOver && (isNearTotalBudget || nearCategories.length > 0);
  const allocationExceedsTotal = totalBudget > 0 && totalAllocatedSum > totalBudget;

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${isAdmin ? 'text-white' : 'text-neutral-950'}`}>Quản lý Ngân sách Chuyến đi</h2>
          <p className={`text-xs mt-0.5 ${isAdmin ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Theo dõi chi phí dự kiến từ lịch trình đã duyệt &amp; hóa đơn chứng từ thực tế (tự khử trùng khi liên kết)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            title="Tải xuống báo cáo chi tiêu định dạng CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Xuất CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReportPreviewOpen(true)}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            title="Xem trước & in báo cáo quyết toán chi tiêu"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-600" />
            <span>Báo cáo / In</span>
          </button>

          <span aria-hidden="true" className={`hidden sm:block w-px h-5 mx-0.5 ${isAdmin ? 'bg-neutral-700' : 'bg-neutral-200'}`} />

          <button
            type="button"
            onClick={onOpenEditAllocations}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-neutral-600" />
            <span>Phân bổ 5 hạng mục</span>
          </button>

          <button
            type="button"
            onClick={onOpenEditBudget}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
            <span>Sửa hạn mức</span>
          </button>

          <button
            type="button"
            onClick={openCreateInvoiceModal}
            title={invoiceLimitReached ? 'Chuyến đi đã đạt giới hạn 100 hóa đơn' : 'Ghi nhận hóa đơn mới'}
            className={`h-9 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              invoiceLimitReached
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{invoiceLimitReached ? 'Đã đủ 100 hóa đơn' : 'Ghi nhận hóa đơn'}</span>
          </button>
        </div>
      </div>

      {/* Overrun / Near-limit Alert Banner */}
      {(hasAnyOver || hasAnyNear || allocationExceedsTotal) && (
        <div
          className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
            hasAnyOver
              ? 'bg-red-50 border-red-300 text-red-950'
              : 'bg-neutral-950 border-red-600/50 text-neutral-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                hasAnyOver ? 'bg-red-100 text-red-600' : 'bg-red-600/20 text-red-400 border border-red-500/30'
              }`}
            >
              {hasAnyOver ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-sm">
                {hasAnyOver
                  ? 'Cảnh báo vượt hạn mức ngân sách!'
                  : hasAnyNear
                    ? 'Cảnh báo chi tiêu sắp chạm hạn mức (≥85%)!'
                    : 'Lưu ý phân bổ hạng mục vượt tổng dự toán'}
              </div>

              {isOverTotalBudget && (
                <p className="font-medium">
                  · Tổng chi (thực chi + dự kiến đã duyệt) đã vượt tổng hạn mức{' '}
                  <span className="font-mono font-bold underline tabular-nums">
                    +{overBudgetAmount.toLocaleString('vi-VN')} ₫
                  </span>{' '}
                  ({rawPercentUsed}% dự toán).
                </p>
              )}

              {!isOverTotalBudget && isNearTotalBudget && (
                <p className="font-medium">
                  · Tổng chi (thực chi + dự kiến đã duyệt) đã đạt{' '}
                  <span className="font-mono font-bold tabular-nums">{rawPercentUsed}%</span> hạn mức (còn lại{' '}
                  <span className="font-mono font-bold tabular-nums">{remainingBudget.toLocaleString('vi-VN')} ₫</span>).
                </p>
              )}

              {overCategories.length > 0 && (
                <p className="font-medium">
                  · Hạng mục vượt mức:{' '}
                  {overCategories.map((c, idx) => (
                    <span key={c.id} className="font-semibold tabular-nums">
                      {idx > 0 ? ', ' : ''}
                      {c.shortName} (+{c.overAmount.toLocaleString('vi-VN')} ₫)
                    </span>
                  ))}
                  .
                </p>
              )}

              {nearCategories.length > 0 && (
                <p className="font-medium">
                  · Hạng mục sắp chạm mức:{' '}
                  {nearCategories.map((c, idx) => (
                    <span key={c.id} className="font-semibold tabular-nums">
                      {idx > 0 ? ', ' : ''}
                      {c.shortName} ({c.rawPercent}%)
                    </span>
                  ))}
                  .
                </p>
              )}

              {allocationExceedsTotal && (
                <p className="font-medium opacity-90 tabular-nums">
                  · Tổng hạn mức 5 hạng mục ({totalAllocatedSum.toLocaleString('vi-VN')} ₫) đang cao hơn tổng ngân sách tour (
                  {totalBudget.toLocaleString('vi-VN')} ₫) là{' '}
                  <span className="font-mono font-bold">
                    +{(totalAllocatedSum - totalBudget).toLocaleString('vi-VN')} ₫
                  </span>
                  .
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenEditBudget}
              className={`h-8 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                hasAnyOver
                  ? 'bg-white border-red-300 text-red-700 hover:bg-red-100'
                  : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
              }`}
            >
              Điều chỉnh hạn mức
            </button>
          </div>
        </div>
      )}

      {/* Top 3 KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white text-neutral-900 border border-neutral-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-neutral-500">Tổng hạn mức ngân sách</span>
            <button
              type="button"
              onClick={onOpenEditBudget}
              className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Chỉnh sửa
            </button>
          </div>
          <div className="text-2xl font-bold text-neutral-950 tracking-tight font-mono tabular-nums">
            {totalBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-neutral-500 mt-1.5 inline-block">
            {totalBudget > 0 ? `100% dự toán tour ${trip.code}` : `Chưa thiết lập dự toán cho tour ${trip.code}`}
          </span>
        </div>

        <div className="p-5 rounded-xl bg-white text-neutral-900 border border-neutral-200">
          <span className="text-xs font-medium text-neutral-500 block mb-1">Tổng chi dự kiến &amp; thực tế</span>
          <div
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
              isOverTotalBudget
                ? 'text-red-600'
                : isNearTotalBudget
                  ? 'text-neutral-950'
                  : 'text-blue-700'
            }`}
          >
            {spentBudget.toLocaleString('vi-VN')} ₫
          </div>
          <div className="text-xs text-neutral-500 mt-1.5 space-y-0.5 tabular-nums">
            <div>
              Chiếm{' '}
              <strong className={isOverTotalBudget ? 'text-red-600' : isNearTotalBudget ? 'text-red-700' : 'text-neutral-900'}>
                {rawPercentUsed}%
              </strong>{' '}
              tổng dự toán ({activityCount} hoạt động, {invoiceCount} hóa đơn)
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">
              Thực chi: <strong className="text-neutral-800">{actualSpentBudget.toLocaleString('vi-VN')} ₫</strong> · Dự kiến:{' '}
              <strong className="text-neutral-800">{plannedCommittedBudget.toLocaleString('vi-VN')} ₫</strong>
            </div>
            {pendingApprovalCount > 0 && (
              <div className="text-[11px] text-red-600 font-medium">
                {pendingApprovalCount} mục Chờ duyệt ({pendingApprovalBudget.toLocaleString('vi-VN')} ₫) chưa tính vào tổng chi
              </div>
            )}
          </div>
        </div>

        <div
          className={`p-5 rounded-xl border ${
            isOverTotalBudget
              ? 'bg-red-50/70 border-red-300'
              : isNearTotalBudget
                ? 'bg-neutral-950 border-neutral-900 text-white'
                : 'bg-white text-neutral-900 border-neutral-200'
          }`}
        >
          <span className={`text-xs font-medium block mb-1 ${isNearTotalBudget && !isOverTotalBudget ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {isOverTotalBudget ? 'Vượt hạn mức ngân sách' : 'Dự toán còn lại'}
          </span>
          <div
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
              isOverTotalBudget
                ? 'text-red-600'
                : isNearTotalBudget
                  ? 'text-white'
                  : 'text-neutral-950'
            }`}
          >
            {isOverTotalBudget
              ? `+${overBudgetAmount.toLocaleString('vi-VN')} ₫`
              : `${remainingBudget.toLocaleString('vi-VN')} ₫`}
          </div>
          <span
            className={`text-xs font-medium mt-1.5 inline-block tabular-nums ${
              isOverTotalBudget
                ? 'text-red-600'
                : isNearTotalBudget
                  ? 'text-red-400'
                  : 'text-blue-700'
            }`}
          >
            {isOverTotalBudget
              ? `Vượt ${Math.max(1, rawPercentUsed - 100)}% so với hạn mức`
              : totalBudget <= 0
                ? 'Bấm Chỉnh sửa để đặt tổng ngân sách'
                : remainingBudget > 0
                  ? `Khả dụng: ${Math.round((remainingBudget / totalBudget) * 100)}% kế hoạch`
                  : 'Đã dùng đủ 100% hạn mức ngân sách'}
          </span>
        </div>
      </div>

      {/* 5 Categories Breakdown */}
      <div className="bg-white text-neutral-900 rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-neutral-950">Chi tiết phân bổ 5 hạng mục dịch vụ</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tính từ hoạt động đã duyệt (chưa gán hóa đơn) và hóa đơn thực tế · Hoạt động Điều hành không ăn vào Dự phòng 5%
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenEditAllocations}
            className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Điều chỉnh tỷ lệ phân bổ</span>
          </button>
        </div>

        <div className="divide-y divide-neutral-100 text-xs">
          {categories.map((cat) => (
            <div key={cat.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/80 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h4 className="font-semibold text-neutral-950 text-sm">{cat.name}</h4>
                  <span className="text-xs text-neutral-400 tabular-nums">
                    · {cat.count} mục chi
                  </span>
                </div>
                <div className="w-full max-w-sm bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      cat.level === 'over'
                        ? 'bg-red-600'
                        : cat.level === 'near'
                          ? 'bg-neutral-950'
                          : 'bg-blue-600'
                    }`}
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
                {cat.level === 'over' ? (
                  <p className="text-[11px] font-semibold text-red-600 mt-1.5 tabular-nums">
                    {cat.allocated > 0 ? `Đã dùng ${cat.rawPercent}% · ` : ''}
                    Vượt hạn mức +{cat.overAmount.toLocaleString('vi-VN')} ₫
                  </p>
                ) : cat.level === 'near' ? (
                  <p className="text-[11px] font-semibold text-red-700 mt-1.5 tabular-nums">
                    Đã dùng {cat.rawPercent}% · Còn lại {cat.remaining.toLocaleString('vi-VN')} ₫
                  </p>
                ) : cat.spent > 0 && cat.allocated > 0 ? (
                  <p className="text-[11px] text-neutral-500 mt-1.5 tabular-nums">
                    Đã dùng {cat.rawPercent}% · Còn {cat.remaining.toLocaleString('vi-VN')} ₫
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-6 sm:text-right shrink-0">
                <div>
                  <span className="text-neutral-400 block text-[11px]">Đã chi</span>
                  <span
                    className={`font-bold font-mono text-xs tabular-nums ${
                      cat.level === 'over' ? 'text-red-600' : 'text-neutral-950'
                    }`}
                  >
                    {cat.spent.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Hạn mức</span>
                  <span className="font-semibold text-neutral-500 font-mono text-xs tabular-nums">
                    {cat.allocated.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="min-w-[116px] sm:text-right">
                  <span
                    className={`text-xs font-semibold ${
                      cat.level === 'over'
                        ? 'text-red-600'
                        : cat.level === 'near'
                          ? 'text-neutral-950'
                          : cat.level === 'normal'
                            ? 'text-blue-700'
                            : 'text-neutral-400'
                    }`}
                  >
                    {cat.status === 'Sắp chạm mức' ? 'Sắp chạm (≥85%)' : cat.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
