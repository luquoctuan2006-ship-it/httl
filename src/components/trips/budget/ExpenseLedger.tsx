import React from 'react';
import { Calendar, Edit3, Eye, Plus, Receipt, Tag, Trash2 } from 'lucide-react';
import type { Activity, ExpenseInvoice, TripData } from '../../../types/travel';
import { ReceiptImage } from './ReceiptImage';

interface ExpenseLedgerProps {
  trip: TripData;
  activeTab: 'invoices' | 'activities';
  setActiveTab: React.Dispatch<React.SetStateAction<'invoices' | 'activities'>>;
  invoices: ExpenseInvoice[];
  expenseActivities: Activity[];
  filteredInvoices: ExpenseInvoice[];
  filteredActivities: Activity[];
  onCreateInvoice: () => void;
  onPreviewReceipt: (invoice: ExpenseInvoice) => void;
  onEditInvoice: (invoice: ExpenseInvoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onEditActivity: (activity: Activity) => void;
}

export function ExpenseLedger(props: ExpenseLedgerProps) {
  const {
    trip,
    activeTab,
    setActiveTab,
    invoices,
    expenseActivities,
    filteredInvoices,
    filteredActivities,
    onCreateInvoice,
    onPreviewReceipt,
    onEditInvoice,
    onDeleteInvoice,
    onEditActivity,
  } = props;

  return (
    <>
      {/* Tabs: Hóa đơn chứng từ vs Chi tiêu theo lịch trình */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Hóa đơn &amp; Chứng từ thực tế ({invoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activities')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'activities' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Chi phí hoạt động theo lịch trình ({expenseActivities.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onCreateInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm hóa đơn/phiếu chi</span>
          </button>
        </div>

        {/* Tab 1: Real Invoices & Receipts */}
        {activeTab === 'invoices' && (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredInvoices.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Chưa có hóa đơn hoặc chứng từ chi tiêu nào được ghi nhận.</p>
                <button
                  type="button"
                  onClick={onCreateInvoice}
                  className="text-teal-600 font-bold hover:underline"
                >
                  + Ghi nhận hóa đơn / phiếu chi đầu tiên
                </button>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 gap-4 transition">
                  <div className="flex items-start gap-3">
                    {inv.receiptImage || inv.receiptId ? (
                      <button
                        type="button"
                        onClick={() => onPreviewReceipt(inv)}
                        title="Xem ảnh chứng từ đính kèm"
                        className="w-10 h-10 rounded-xl overflow-hidden border border-teal-200 shrink-0 relative group cursor-pointer"
                      >
                        <ReceiptImage
                          tripId={trip.id}
                          receiptId={inv.receiptId}
                          receiptImage={inv.receiptImage}
                          alt={inv.title}
                          className="w-full h-full object-cover"
                        />
                        <span className="inset-0 absolute bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                        <Receipt className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-extrabold text-slate-900">{inv.title}</h5>
                        {inv.invoiceNumber && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            HD: {inv.invoiceNumber}
                          </span>
                        )}
                        <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                          {inv.category}
                        </span>
                        {(inv.receiptImage || inv.receiptId) && (
                          <button
                            type="button"
                            onClick={() => onPreviewReceipt(inv)}
                            className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold hover:bg-sky-100 transition inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Xem chứng từ</span>
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        {inv.vendor && <span>Đơn vị: <strong>{inv.vendor}</strong></span>}
                        <span>Ngày {inv.dayIndex ? `tour: Ngày ${inv.dayIndex}` : ''} ({inv.date})</span>
                        {inv.note && <span className="text-slate-400 italic">• {inv.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <span className="font-mono font-extrabold text-emerald-700 text-sm block">
                        -{inv.amount.toLocaleString('vi-VN')} ₫
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Đã thanh toán</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditInvoice(inv)}
                      className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-400 hover:text-teal-700 transition"
                      title="Chỉnh sửa hóa đơn"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteInvoice(inv.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Xóa hóa đơn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Activity Expenses */}
        {activeTab === 'activities' && (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredActivities.map((act) => (
              <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 gap-3 group transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">{act.title}</h5>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {act.location} • {act.timeStart}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block text-sm">
                      {(act.cost || 0).toLocaleString('vi-VN')} ₫
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {act.type}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditActivity(act)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                    title="Chỉnh sửa chi phí hoạt động"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


    </>
  );
}
