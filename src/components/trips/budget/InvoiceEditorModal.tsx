import React from 'react';
import { ImagePlus, Receipt, X } from 'lucide-react';
import type { ExpenseInvoice, TripData } from '../../../types/travel';
import { ReceiptImage } from './ReceiptImage';

interface InvoiceEditorModalProps {
  trip: TripData;
  isOpen: boolean;
  editingInvoiceId: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  amount: number;
  setAmount: React.Dispatch<React.SetStateAction<number>>;
  category: ExpenseInvoice['category'];
  setCategory: React.Dispatch<React.SetStateAction<ExpenseInvoice['category']>>;
  vendor: string;
  setVendor: React.Dispatch<React.SetStateAction<string>>;
  invoiceNumber: string;
  setInvoiceNumber: React.Dispatch<React.SetStateAction<string>>;
  date: string;
  setDate: React.Dispatch<React.SetStateAction<string>>;
  dayIndex: number;
  setDayIndex: React.Dispatch<React.SetStateAction<number>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  receiptImage?: string;
  setReceiptImage: React.Dispatch<React.SetStateAction<string | undefined>>;
  receiptId?: string;
  setReceiptId: React.Dispatch<React.SetStateAction<string | undefined>>;
  isUploadingReceipt: boolean;
  isSavingInvoice: boolean;
  receiptUploadError: string | null;
  onReceiptFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InvoiceEditorModal(props: InvoiceEditorModalProps) {
  const {
    trip,
    isOpen,
    editingInvoiceId,
    onClose,
    onSubmit,
    title,
    setTitle,
    amount,
    setAmount,
    category,
    setCategory,
    vendor,
    setVendor,
    invoiceNumber,
    setInvoiceNumber,
    date,
    setDate,
    dayIndex,
    setDayIndex,
    note,
    setNote,
    receiptImage,
    setReceiptImage,
    receiptId,
    setReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
    onReceiptFileChange,
  } = props;

  return (
    <>
      {/* Modal: Ghi nhận / Chỉnh sửa hóa đơn/chi tiêu thực tế */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">
                  {editingInvoiceId ? 'Chỉnh sửa hóa đơn & chứng từ' : 'Ghi nhận hóa đơn & chi tiêu thực tế'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên khoản chi / Nội dung hóa đơn *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Tiền xăng xe 29 chỗ chặng Hải Vân"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiền (VNĐ) *</label>
                  <input
                    type="number"
                    min={1000}
                    step={50000}
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phân loại hạng mục</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    <option value="transport">Vận chuyển & Thuê xe</option>
                    <option value="hotel">Khách sạn & Lưu trú</option>
                    <option value="meal">Ẩm thực & Nhà hàng</option>
                    <option value="sightseeing">Vé tham quan & Cáp treo</option>
                    <option value="contingency">Dự phòng & Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị cung cấp / Nhà xe</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="Nhà xe Tuấn Anh, KS Grand..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số phiếu thu / Hóa đơn</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="HD-8849"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày lập hóa đơn</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thuộc Ngày tour</label>
                  <select
                    value={dayIndex}
                    onChange={(e) => setDayIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    {trip.days.map((d) => (
                      <option key={d.dayIndex} value={d.dayIndex}>
                        Ngày {d.dayIndex} ({d.dayName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú thêm</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thanh toán qua chuyển khoản, người nhận..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                />
              </div>

              {/* Ảnh chứng từ đính kèm */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Ảnh chứng từ / Hóa đơn giấy</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-teal-400 bg-teal-50/70 hover:bg-teal-100/70 text-teal-800 font-bold cursor-pointer transition">
                    <ImagePlus className="w-4 h-4" />
                    <span>
                      {isUploadingReceipt
                        ? 'Đang nén & tải ảnh lên...'
                        : receiptImage || receiptId
                          ? 'Đổi ảnh chứng từ'
                          : 'Đính kèm ảnh hóa đơn'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingReceipt}
                      onChange={onReceiptFileChange}
                      className="hidden"
                    />
                  </label>
                  {(receiptImage || receiptId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptImage(undefined);
                        setReceiptId(undefined);
                      }}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Gỡ ảnh
                    </button>
                  )}
                </div>
                {receiptUploadError && (
                  <p className="text-[11px] text-rose-600 font-semibold">{receiptUploadError}</p>
                )}
                {(receiptImage || receiptId) && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1.5">
                    <ReceiptImage
                      tripId={trip.id}
                      receiptId={receiptId}
                      receiptImage={receiptImage}
                      alt="Xem trước ảnh chứng từ"
                      className="max-h-40 w-full object-contain rounded-lg"
                    />
                    {receiptId && (
                      <p className="text-[10px] text-teal-700 font-semibold mt-1 text-center">
                        Ảnh đã lưu tách riêng trên máy chủ (không tốn dung lượng lịch trình)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                  }}
                  disabled={isSavingInvoice}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploadingReceipt || isSavingInvoice}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSavingInvoice
                    ? 'Đang lưu...'
                    : editingInvoiceId
                      ? 'Cập nhật hóa đơn'
                      : 'Lưu hóa đơn & Cập nhật ngân sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </>
  );
}
