import React from 'react';
import { Download, Edit3, Plus, Printer, Sliders } from 'lucide-react';
import type { TripData } from '../../../types/travel';
import type { BudgetCategory } from './types';

interface BudgetSummaryProps {
  trip: TripData;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  percentUsed: number;
  activityCount: number;
  invoiceCount: number;
  categories: BudgetCategory[];
  handleExportCsv: () => void;
  setIsReportPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditAllocationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditBudgetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openCreateInvoiceModal: () => void;
}

export function BudgetSummary(props: BudgetSummaryProps) {
  const {
    trip,
    totalBudget,
    spentBudget,
    remainingBudget,
    percentUsed,
    activityCount,
    invoiceCount,
    categories,
    handleExportCsv,
    setIsReportPreviewOpen,
    setIsEditAllocationsOpen,
    setIsEditBudgetOpen,
    openCreateInvoiceModal,
  } = props;

  return (
    <>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Quản lý Ngân sách Chuyến đi</h2>
          <p className="text-xs text-slate-500 font-medium">
            Theo dõi chi tiêu thực tế tự động từ lịch trình tour &amp; quản lý hóa đơn chứng từ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
            title="Tải xuống báo cáo chi tiêu định dạng CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Xuất CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReportPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
            title="Xem trước & in báo cáo quyết toán chi tiêu"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Báo cáo / In</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditAllocationsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Phân bổ 5 hạng mục</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditBudgetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Sửa hạn mức</span>
          </button>

          <button
            type="button"
            onClick={openCreateInvoiceModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi nhận hóa đơn/chi tiêu</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI stats - COMPUTED DYNAMICALLY, ZERO HARDCODED */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Tổng hạn mức ngân sách</span>
            <button
              type="button"
              onClick={() => setIsEditBudgetOpen(true)}
              className="text-[11px] text-teal-600 hover:underline font-bold"
            >
              Chỉnh sửa
            </button>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {totalBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-teal-700 font-medium mt-1 inline-block">
            100% dự toán tour {trip.code}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Đã giải ngân thực tế</span>
          <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
            {spentBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
            Chiếm {percentUsed}% tổng dự toán ({activityCount} hoạt động, {invoiceCount} chứng từ)
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Dự toán còn lại</span>
          <div className="text-2xl font-black text-blue-600 tracking-tight font-mono">
            {remainingBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">
            {remainingBudget > 0 ? `Khả dụng: ${Math.round((remainingBudget / totalBudget) * 100)}% kế hoạch` : 'Đã đạt hạn mức ngân sách'}
          </span>
        </div>
      </div>

      {/* 5 Categories Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Chi tiết phân bổ 5 hạng mục dịch vụ</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tự động tính từ các hoạt động lịch trình và hóa đơn thực tế
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditAllocationsOpen(true)}
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Điều chỉnh tỷ lệ phân bổ</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {categories.map((cat) => (
            <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">{cat.name}</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {cat.count} mục chi
                  </span>
                </div>
                <div className="w-full max-w-xs bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${cat.spent >= cat.allocated ? 'bg-rose-500' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min((cat.spent / cat.allocated) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 sm:text-right">
                <div>
                  <span className="text-slate-400 block text-[11px]">Đã chi:</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">{cat.spent.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạn mức:</span>
                  <span className="font-bold text-slate-500 font-mono text-xs">{cat.allocated.toLocaleString('vi-VN')} ₫</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    cat.status === 'Vượt hạn mức'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : cat.status === 'Đang dùng'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>


    </>
  );
}
