import React, { useMemo, useState } from 'react';
import { Calendar, Edit3, Eye, Link2, Plus, Receipt, Tag, Trash2 } from 'lucide-react';
import { MAX_INVOICES_PER_TRIP } from '../../../data/normalizeTripData';
import type { Activity, ExpenseInvoice, TripData } from '../../../types/travel';
import { Modal, ModalFooter } from '../../common/Modal';
import { ReceiptImage } from './ReceiptImage';

const INVOICE_CATEGORY_LABELS: Record<ExpenseInvoice['category'], string> = {
  transport: 'Vận chuyển & Xe',
  hotel: 'Khách sạn & Lưu trú',
  meal: 'Ẩm thực & Nhà hàng',
  sightseeing: 'Vé tham quan & Trải nghiệm',
  contingency: 'Dự phòng & Khác',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  sightseeing: 'Tham quan',
  meal: 'Ăn uống',
  transport: 'Di chuyển xe',
  hotel: 'Khách sạn / Lưu trú',
  checkin: 'Check-in / Lưu trú',
  briefing: 'Điều hành / Tập trung',
};

interface ExpenseLedgerProps {
  trip: TripData;
  activeTab: 'invoices' | 'activities';
  setActiveTab: React.Dispatch<React.SetStateAction<'invoices' | 'activities'>>;
  invoices: ExpenseInvoice[];
  expenseActivities: Activity[];
  linkedActivityIds: Set<string>;
  filteredInvoices: ExpenseInvoice[];
  filteredActivities: Activity[];
  searchQuery?: string;
  onClearSearch?: () => void;
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
    linkedActivityIds,
    filteredInvoices,
    filteredActivities,
    searchQuery = '',
    onClearSearch,
    onCreateInvoice,
    onPreviewReceipt,
    onEditInvoice,
    onDeleteInvoice,
    onEditActivity,
  } = props;

  const [invoiceToDelete, setInvoiceToDelete] = useState<ExpenseInvoice | null>(null);
  const hasQuery = Boolean(searchQuery.trim());
  const invoiceLimitReached = invoices.length >= MAX_INVOICES_PER_TRIP;

  const activityTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of trip.days || []) {
      for (const act of day.activities || []) {
        map.set(act.id, act.title);
      }
    }
    return map;
  }, [trip.days]);

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
              <span>Hóa đơn &amp; Chứng từ ({invoices.length}/{MAX_INVOICES_PER_TRIP})</span>
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition ${
              invoiceLimitReached
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{invoiceLimitReached ? `Đã đủ ${MAX_INVOICES_PER_TRIP} hóa đơn` : 'Thêm hóa đơn/phiếu chi'}</span>
          </button>
        </div>

        {/* Tab 1: Real Invoices & Receipts */}
        {activeTab === 'invoices' && (
          <div className="divide-y divide-slate-100 text-xs">
            {invoiceLimitReached && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-[11px] font-semibold text-amber-800">
                Chuyến đi đã đạt tối đa {MAX_INVOICES_PER_TRIP} hóa đơn. Hãy chỉnh sửa hoặc xóa bớt hóa đơn cũ nếu cần ghi nhận thêm.
              </div>
            )}

            {filteredInvoices.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p>
                  {hasQuery
                    ? `Không tìm thấy hóa đơn nào khớp với "${searchQuery}".`
                    : 'Chưa có hóa đơn hoặc chứng từ chi tiêu nào được ghi nhận.'}
                </p>
                {hasQuery && onClearSearch ? (
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Xem tất cả hóa đơn
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCreateInvoice}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    + Ghi nhận hóa đơn / phiếu chi đầu tiên
                  </button>
                )}
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const linkedActTitle = inv.linkedActivityId ? activityTitleById.get(inv.linkedActivityId) : undefined;
                return (
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
                            {INVOICE_CATEGORY_LABELS[inv.category] || inv.category}
                          </span>
                          {linkedActTitle && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              <span>Thay dự toán: {linkedActTitle}</span>
                            </span>
                          )}
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
                          <span>
                            {inv.dayIndex ? `Ngày ${inv.dayIndex}` : 'Chứng từ chung'}
                            {inv.date ? ` • ${inv.date}` : ''}
                          </span>
                          {inv.note && <span className="text-slate-400 italic">• {inv.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <span className="font-mono font-extrabold text-emerald-700 text-sm block">
                          -{inv.amount.toLocaleString('vi-VN')} ₫
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Thực chi</span>
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
                        onClick={() => setInvoiceToDelete(inv)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Xóa hóa đơn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Activity Expenses */}
        {activeTab === 'activities' && (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredActivities.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p>
                  {hasQuery
                    ? `Không có hoạt động phát sinh chi phí nào khớp với "${searchQuery}".`
                    : 'Chưa có hoạt động nào trong lịch trình có chi phí dự toán (> 0 ₫).'}
                </p>
                {hasQuery && onClearSearch && (
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Xem tất cả hoạt động có chi phí
                  </button>
                )}
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isLinkedToInvoice = linkedActivityIds.has(act.id);
                const isPendingApproval = act.status === 'Chờ duyệt';
                const isBriefing = act.type === 'briefing';
                const isExcludedFromTotal = isLinkedToInvoice || isPendingApproval || isBriefing;

                return (
                  <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 gap-3 group transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-slate-900">{act.title}</h5>
                          {isLinkedToInvoice ? (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                              Đã có hóa đơn thực tế (không cộng trùng)
                            </span>
                          ) : isPendingApproval ? (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                              Chờ duyệt — chưa tính vào tổng chi
                            </span>
                          ) : isBriefing ? (
                            <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                              Điều hành — không tính vào 5 hạng mục
                            </span>
                          ) : act.status === 'Hoàn tất' ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              Hoàn tất
                            </span>
                          ) : (
                            <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                              Dự kiến lịch trình
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {act.location} • {act.timeStart}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right shrink-0">
                      <div>
                        <span
                          className={`font-mono font-bold block text-sm ${
                            isExcludedFromTotal ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {(act.cost || 0).toLocaleString('vi-VN')} ₫
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {ACTIVITY_TYPE_LABELS[act.type] || act.type}
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
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal xác nhận xóa hóa đơn */}
      <Modal
        isOpen={Boolean(invoiceToDelete)}
        onClose={() => setInvoiceToDelete(null)}
        maxWidth="sm"
        hideHeader
      >
        <div className="p-6 text-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Xóa hóa đơn này?</h3>
            <p className="text-slate-500 mt-1 leading-relaxed">
              Hóa đơn <strong>&quot;{invoiceToDelete?.title}&quot;</strong> (
              <span className="font-mono font-bold text-slate-700">
                {(invoiceToDelete?.amount || 0).toLocaleString('vi-VN')} ₫
              </span>
              ) cùng ảnh chứng từ đính kèm sẽ bị xóa khỏi ngân sách chuyến đi.
            </p>
          </div>
          <ModalFooter
            cancelLabel="Hủy bỏ"
            onCancel={() => setInvoiceToDelete(null)}
            submitLabel="Xác nhận xóa"
            submitType="button"
            onSubmitClick={() => {
              if (invoiceToDelete) {
                onDeleteInvoice(invoiceToDelete.id);
              }
              setInvoiceToDelete(null);
            }}
            submitVariant="rose"
            bordered={false}
            align="center"
          />
        </div>
      </Modal>
    </>
  );
}
