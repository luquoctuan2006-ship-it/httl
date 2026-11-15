import React from 'react';
import { ImagePlus, Receipt } from 'lucide-react';
import type { ExpenseInvoice, TripData } from '../../../types/travel';
import { Modal, ModalFooter } from '../../common/Modal';
import { Field, SelectInput, TextInput } from '../../common/Field';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingInvoiceId ? 'Chỉnh sửa hóa đơn & chứng từ' : 'Ghi nhận hóa đơn & chi tiêu thực tế'}
      icon={<Receipt className="w-4 h-4" />}
      scrollable
    >
      <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
        <Field label="Tên khoản chi / Nội dung hóa đơn *">
          <TextInput
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Tiền xăng xe 29 chỗ chặng Hải Vân"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Số tiền (VNĐ) *">
            <TextInput
              type="number"
              min={1000}
              step={50000}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="font-mono font-bold"
            />
          </Field>

          <Field label="Phân loại hạng mục">
            <SelectInput
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseInvoice['category'])}
            >
              <option value="transport">Vận chuyển &amp; Thuê xe</option>
              <option value="hotel">Khách sạn &amp; Lưu trú</option>
              <option value="meal">Ẩm thực &amp; Nhà hàng</option>
              <option value="sightseeing">Vé tham quan &amp; Cáp treo</option>
              <option value="contingency">Dự phòng &amp; Khác</option>
            </SelectInput>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Đơn vị cung cấp / Nhà xe">
            <TextInput
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Nhà xe Tuấn Anh, KS Grand..."
            />
          </Field>

          <Field label="Số phiếu thu / Hóa đơn">
            <TextInput
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="HD-8849"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày lập hóa đơn">
            <TextInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Thuộc Ngày tour">
            <SelectInput
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
            >
              {trip.days.map((d) => (
                <option key={d.dayIndex} value={d.dayIndex}>
                  Ngày {d.dayIndex} ({d.dayName})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field label="Ghi chú thêm">
          <TextInput
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Thanh toán qua chuyển khoản, người nhận..."
          />
        </Field>

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

        <ModalFooter
          onCancel={onClose}
          cancelDisabled={isSavingInvoice}
          disabled={isUploadingReceipt || isSavingInvoice}
          submitLabel={
            isSavingInvoice
              ? 'Đang lưu...'
              : editingInvoiceId
                ? 'Cập nhật hóa đơn'
                : 'Lưu hóa đơn & Cập nhật ngân sách'
          }
        />
      </form>
    </Modal>
  );
}
