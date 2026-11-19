import { Download, FileText, Printer, X } from 'lucide-react';
import type { Activity, ExpenseInvoice, TripData } from '../../../types/travel';

interface ExpenseReportModalProps {
  isOpen: boolean;
  trip: TripData;
  totalBudget: number;
  spentBudget: number;
  actualSpentBudget?: number;
  plannedCommittedBudget?: number;
  remainingBudget: number;
  invoices: ExpenseInvoice[];
  expenseActivities: Activity[];
  linkedActivityIds?: Set<string>;
  onExportCsv: () => void;
  onPrint: () => void;
  onClose: () => void;
}

export function ExpenseReportModal(props: ExpenseReportModalProps) {
  const {
    isOpen,
    trip,
    totalBudget,
    spentBudget,
    actualSpentBudget = 0,
    plannedCommittedBudget = 0,
    remainingBudget,
    invoices,
    expenseActivities,
    linkedActivityIds = new Set<string>(),
    onExportCsv,
    onPrint,
    onClose,
  } = props;

  return (
    <>
      {/* Modal: Báo cáo chi tiêu & In quyết toán */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-3xl w-full border border-neutral-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-neutral-950 text-white border-b-2 border-blue-600 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-extrabold">Báo cáo Quyết toán Chi tiêu — {trip.code}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPrint()}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-neutral-800">
              <div className="border-b border-neutral-200 pb-4 flex flex-wrap justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-neutral-950">{trip.title}</h4>
                  <p className="text-neutral-500 mt-0.5">Mã tour: {trip.code} · Thời gian: {trip.dates}</p>
                </div>
                <div className="text-right font-mono space-y-0.5 tabular-nums">
                  <div>Hạn mức: <strong>{totalBudget.toLocaleString('vi-VN')} ₫</strong></div>
                  <div className="text-neutral-950">Tổng chi hợp lệ: <strong>{spentBudget.toLocaleString('vi-VN')} ₫</strong></div>
                  <div className="text-[11px] text-neutral-500">
                    (Thực chi: {actualSpentBudget.toLocaleString('vi-VN')} ₫ · Dự kiến: {plannedCommittedBudget.toLocaleString('vi-VN')} ₫)
                  </div>
                  {totalBudget > 0 && spentBudget > totalBudget ? (
                    <div className="text-red-600">
                      Vượt hạn mức: <strong>+{(spentBudget - totalBudget).toLocaleString('vi-VN')} ₫</strong>
                    </div>
                  ) : (
                    <div className="text-blue-700">Còn lại: <strong>{remainingBudget.toLocaleString('vi-VN')} ₫</strong></div>
                  )}
                </div>
              </div>

              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-neutral-300 text-[11px] uppercase text-neutral-500">
                    <th className="py-2 pr-2">Loại</th>
                    <th className="py-2 pr-2">Nội dung</th>
                    <th className="py-2 pr-2">Ngày / NCC</th>
                    <th className="py-2 pr-2">Chứng từ / Trạng thái</th>
                    <th className="py-2 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 pr-2 font-semibold text-blue-700">Hóa đơn</td>
                      <td className="py-2 pr-2 font-bold">{inv.title}</td>
                      <td className="py-2 pr-2 text-neutral-500">
                        {inv.date}{inv.vendor ? ` · ${inv.vendor}` : ''}
                      </td>
                      <td className="py-2 pr-2 font-mono">{inv.invoiceNumber || (inv.receiptImage || inv.receiptId ? 'Có ảnh' : 'Thực chi')}</td>
                      <td className="py-2 text-right font-mono font-bold tabular-nums">{inv.amount.toLocaleString('vi-VN')} ₫</td>
                    </tr>
                  ))}
                  {expenseActivities.map((act) => {
                    const isLinked = linkedActivityIds.has(act.id);
                    const isPending = act.status === 'Chờ duyệt';
                    const isBriefing = act.type === 'briefing';
                    const isExcluded = isLinked || isPending || isBriefing;
                    const noteLabel = isLinked
                      ? 'Đã thay bằng hóa đơn'
                      : isPending
                        ? 'Chờ duyệt (chưa tính)'
                        : isBriefing
                          ? 'Điều hành (ngoài 5 mục)'
                          : act.status;
                    return (
                      <tr key={act.id} className={isExcluded ? 'text-neutral-400' : undefined}>
                        <td className="py-2 pr-2 font-semibold">Lịch trình</td>
                        <td className="py-2 pr-2 font-bold">{act.title}</td>
                        <td className="py-2 pr-2">{act.location}</td>
                        <td className="py-2 pr-2 text-[11px]">{noteLabel}</td>
                        <td className={`py-2 text-right font-mono font-bold tabular-nums ${isExcluded ? 'line-through' : ''}`}>
                          {(act.cost || 0).toLocaleString('vi-VN')} ₫
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
