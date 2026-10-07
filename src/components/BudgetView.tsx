import React from 'react';
import { Wallet, TrendingDown, DollarSign, PieChart, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { TripData } from '../types/travel';

interface BudgetViewProps {
  trip: TripData;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ trip }) => {
  const categories = [
    { name: 'Vận chuyển & Thuê xe 29 chỗ', allocated: 14000000, spent: 14000000, status: 'Hoàn tất' },
    { name: 'Khách sạn & Resort (Hội An + Đà Nẵng + Huế)', allocated: 18000000, spent: 11000000, status: 'Đang dùng' },
    { name: 'Ăn uống & Nhà hàng ẩm thực địa phương', allocated: 10600000, spent: 3800000, status: 'Đang dùng' },
    { name: 'Vé tham quan & Cáp treo Bà Nà Hills', allocated: 4000000, spent: 0, status: 'Dự kiến' },
    { name: 'Dự phòng rủi ro & Bảo hiểm du lịch', allocated: 2000000, spent: 0, status: 'Dự trữ' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Quản lý Ngân sách Chuyến đi</h2>
          <p className="text-xs text-slate-500 font-medium">
            Theo dõi chi tiêu thực tế so với kế hoạch dự toán tài chính
          </p>
        </div>
      </div>

      {/* Top 3 KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Tổng hạn mức ngân sách</span>
          <div className="text-2xl font-black text-slate-900">48,600,000 ₫</div>
          <span className="text-xs text-teal-600 font-medium mt-1 inline-block">100% Phân bổ</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Đã giải ngân thực tế</span>
          <div className="text-2xl font-black text-emerald-600">18,800,000 ₫</div>
          <span className="text-xs text-slate-500 font-medium mt-1 inline-block">Chiếm 62% kế hoạch đến Ngày 3</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Dự toán còn lại</span>
          <div className="text-2xl font-black text-blue-600">29,800,000 ₫</div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">Tiết kiệm 640.000₫ nhờ Voyager AI</span>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Chi tiết phân bổ theo hạng mục dịch vụ</h3>
          <span className="text-xs font-semibold text-slate-500">Đơn vị: VNĐ</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {categories.map((cat, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">{cat.name}</h4>
                <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-teal-500 h-full rounded-full"
                    style={{ width: `${Math.min((cat.spent / cat.allocated) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center gap-6 sm:text-right">
                <div>
                  <span className="text-slate-400 block text-[11px]">Đã chi:</span>
                  <span className="font-bold text-slate-800 font-mono">{cat.spent.toLocaleString()} ₫</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạn mức:</span>
                  <span className="font-bold text-slate-500 font-mono">{cat.allocated.toLocaleString()} ₫</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  {cat.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
