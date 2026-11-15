import { Download, FileText, Printer, X } from 'lucide-react';
import type { Activity, ExpenseInvoice, TripData } from '../../../types/travel';

interface ExpenseReportModalProps {
  isOpen: boolean;
  trip: TripData;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  invoices: ExpenseInvoice[];
  expenseActivities: Activity[];
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
    remainingBudget,
    invoices,
    expenseActivities,
    onExportCsv,
    onPrint,
    onClose,
  } = props;

  return (
    <>
      {/* Modal: Báo cáo chi tiêu & In quyết toán */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-extrabold">Báo cáo Quyết toán Chi tiêu — {trip.code}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPrint()}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-800">
              <div className="border-b border-slate-200 pb-4 flex flex-wrap justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-slate-900">{trip.title}</h4>
                  <p className="text-slate-500 mt-0.5">Mã tour: {trip.code} • Thời gian: {trip.dates}</p>
                </div>
                <div className="text-right font-mono">
                  <div>Hạn mức: <strong>{totalBudget.toLocaleString('vi-VN')} ₫</strong></div>
                  <div className="text-emerald-700">Đã chi: <strong>{spentBudget.toLocaleString('vi-VN')} ₫</strong></div>
                  <div className="text-blue-700">Còn lại: <strong>{remainingBudget.toLocaleString('vi-VN')} ₫</strong></div>
                </div>
              </div>

              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] uppercase text-slate-500">
                    <th className="py-2 pr-2">Loại</th>
                    <th className="py-2 pr-2">Nội dung</th>
                    <th className="py-2 pr-2">Ngày / NCC</th>
                    <th className="py-2 pr-2">Chứng từ</th>
                    <th className="py-2 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 pr-2 font-semibold text-teal-700">Hóa đơn</td>
                      <td className="py-2 pr-2 font-bold">{inv.title}</td>
                      <td className="py-2 pr-2 text-slate-500">
                        {inv.date}{inv.vendor ? ` • ${inv.vendor}` : ''}
                      </td>
                      <td className="py-2 pr-2 font-mono">{inv.invoiceNumber || (inv.receiptImage || inv.receiptId ? 'Có ảnh' : '—')}</td>
                      <td className="py-2 text-right font-mono font-bold">{inv.amount.toLocaleString('vi-VN')} ₫</td>
                    </tr>
                  ))}
                  {expenseActivities.map((act) => (
                    <tr key={act.id}>
                      <td className="py-2 pr-2 font-semibold text-slate-500">Lịch trình</td>
                      <td className="py-2 pr-2 font-bold">{act.title}</td>
                      <td className="py-2 pr-2 text-slate-500">{act.location}</td>
                      <td className="py-2 pr-2">—</td>
                      <td className="py-2 text-right font-mono font-bold">{(act.cost || 0).toLocaleString('vi-VN')} ₫</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
