import React from 'react';
import { AlertTriangle, ImagePlus, Link2, Receipt } from 'lucide-react';
import type { ExpenseInvoice, TripData } from '../../../types/travel';
import { BUDGET_NEAR_LIMIT_RATIO, getTripDayIndexForIsoDate } from '../../../utils/trip/budgetAlerts';
import { Modal, ModalFooter } from '../../common/Modal';
import { Field, SelectInput, TextInput } from '../../common/Field';
import { ReceiptImage } from './ReceiptImage';
import type { BudgetCategory } from './types';

const ACTIVITY_TYPE_TO_CAT: Record<string, ExpenseInvoice['category']> = {
  transport: 'transport',
  hotel: 'hotel',
  checkin: 'hotel',
  meal: 'meal',
  sightseeing: 'sightseeing',
};

interface InvoiceEditorModalProps {
  trip: TripData;
  isOpen: boolean;
  editingInvoiceId: string | null;
  totalBudget: number;
  spentBudget: number;
  categories: BudgetCategory[];
  linkedActivityIds: Set<string>;
  originalEditingInvoice?: {
    category: ExpenseInvoice['category'];
    amount: number;
    linkedActivityId?: string;
  } | null;
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
  onDateChange: (nextDate: string) => void;
  dayIndex: number;
  onDayIndexChange: (nextDay: number) => void;
  linkedActivityId?: string;
  onLinkedActivityChange: (activityId: string) => void;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  receiptImage?: string;
  setReceiptImage: React.Dispatch<React.SetStateAction<string | undefined>>;
  receiptId?: string;
  setReceiptId: React.Dispatch<React.SetStateAction<string | undefined>>;
  isUploadingReceipt: boolean;
  isSavingInvoice: boolean;
  receiptUploadError: string | null;
  invoiceError: string | null;
  invoiceLimitReached: boolean;
  onReceiptFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InvoiceEditorModal(props: InvoiceEditorModalProps) {
  const {
    trip,
    isOpen,
    editingInvoiceId,
    totalBudget,
    spentBudget,
    categories,
    linkedActivityIds,
    originalEditingInvoice,
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
    onDateChange,
    dayIndex,
    onDayIndexChange,
    linkedActivityId,
    onLinkedActivityChange,
    note,
    setNote,
    receiptImage,
    setReceiptImage,
    receiptId,
    setReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
    invoiceError,
    invoiceLimitReached,
    onReceiptFileChange,
  } = props;

  const allDaysActivities = (trip.days || []).flatMap((d) =>
    (d.activities || []).map((act) => ({ dayIndex: d.dayIndex, activity: act })),
  );
  const selectedLinkedAct = linkedActivityId
    ? allDaysActivities.find((x) => x.activity.id === linkedActivityId)?.activity || null
    : null;
  const origLinkedAct = originalEditingInvoice?.linkedActivityId
    ? allDaysActivities.find((x) => x.activity.id === originalEditingInvoice.linkedActivityId)?.activity || null
    : null;

  const billableReplacedCost = (act: typeof selectedLinkedAct) =>
    act && act.status !== 'Chờ duyệt' && ACTIVITY_TYPE_TO_CAT[act.type] ? act.cost || 0 : 0;

  const origReplacedTotal = billableReplacedCost(origLinkedAct);
  const alreadyLinkedByAnotherInvoice =
    Boolean(selectedLinkedAct) &&
    linkedActivityIds.has(selectedLinkedAct!.id) &&
    selectedLinkedAct!.id !== originalEditingInvoice?.linkedActivityId;
  const nextReplacedTotal = alreadyLinkedByAnotherInvoice ? 0 : billableReplacedCost(selectedLinkedAct);

  // Dự báo trước tác động ròng (đã trừ dự toán hoạt động được liên kết để không tính trùng)
  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  const previousAmount = originalEditingInvoice?.amount || 0;
  const projectedTotalSpent = spentBudget - previousAmount + safeAmount + origReplacedTotal - nextReplacedTotal;
  const targetCat = categories.find((c) => c.id === category);
  const previousCatAmount =
    originalEditingInvoice && originalEditingInvoice.category === category
      ? originalEditingInvoice.amount
      : 0;
  const origCatReplaced =
    origLinkedAct && ACTIVITY_TYPE_TO_CAT[origLinkedAct.type] === category
      ? billableReplacedCost(origLinkedAct)
      : 0;
  const nextCatReplaced =
    !alreadyLinkedByAnotherInvoice &&
    selectedLinkedAct &&
    ACTIVITY_TYPE_TO_CAT[selectedLinkedAct.type] === category
      ? billableReplacedCost(selectedLinkedAct)
      : 0;
  const projectedCatSpent =
    (targetCat?.spent || 0) - previousCatAmount + safeAmount + origCatReplaced - nextCatReplaced;
  const catLimit = targetCat?.allocated || 0;
  const isCatOver = catLimit > 0 && projectedCatSpent > catLimit;
  const isCatNear = !isCatOver && catLimit > 0 && projectedCatSpent >= catLimit * BUDGET_NEAR_LIMIT_RATIO;
  const isTotalOver = totalBudget > 0 && projectedTotalSpent > totalBudget;

  const matchedDayForDate = getTripDayIndexForIsoDate(trip, date);
  const isCreateBlockedByLimit = !editingInvoiceId && invoiceLimitReached;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingInvoiceId ? 'Chỉnh sửa hóa đơn & chứng từ' : 'Ghi nhận hóa đơn & chi tiêu thực tế'}
      icon={<Receipt className="w-4 h-4" />}
      scrollable
    >
      <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
        {invoiceError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold text-red-800">
            {invoiceError}
          </div>
        )}

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
              min={1}
              step={1}
              required
              value={amount > 0 ? amount : ''}
              onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="VD: 500000"
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

        {/* Liên kết hoạt động lịch trình để thay thế chi phí dự kiến, tránh tính trùng */}
        {allDaysActivities.length > 0 && (
          <Field
            label="Liên kết hoạt động trong lịch trình (tránh tính trùng)"
            hint="Nếu chọn hoạt động, số tiền hóa đơn thực tế này sẽ thay thế chi phí dự kiến của hoạt động đó"
          >
            <div className="relative">
              <SelectInput
                value={linkedActivityId || ''}
                onChange={(e) => onLinkedActivityChange(e.target.value)}
              >
                <option value="">Không liên kết (khoản chi phát sinh mới)</option>
                {allDaysActivities.map(({ dayIndex: dIdx, activity: act }) => {
                  const isUsedElsewhere =
                    linkedActivityIds.has(act.id) && act.id !== originalEditingInvoice?.linkedActivityId;
                  return (
                    <option key={act.id} value={act.id}>
                      Ngày {dIdx} • {act.title} ({(act.cost || 0).toLocaleString('vi-VN')} ₫)
                      {isUsedElsewhere ? ' [Đã có hóa đơn]' : ''}
                    </option>
                  );
                })}
              </SelectInput>
            </div>
            {selectedLinkedAct && (
              <p className="text-[11px] text-blue-700 font-medium mt-1 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Thay thế dự toán <strong>{(selectedLinkedAct.cost || 0).toLocaleString('vi-VN')} ₫</strong> của hoạt động &quot;{selectedLinkedAct.title}&quot;.
                </span>
              </p>
            )}
          </Field>
        )}

        {(isCatOver || isCatNear || isTotalOver) && safeAmount > 0 && (
          <div
            className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 text-[11px] font-semibold ${
              isCatOver || isTotalOver
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-neutral-950 border-red-500/40 text-neutral-100'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isCatOver || isTotalOver ? 'text-red-600' : 'text-red-400'}`} />
            <div className="space-y-0.5">
              {isCatOver && targetCat && (
                <div>
                  Khoản chi này sẽ đẩy mục <strong>{targetCat.shortName}</strong> lên{' '}
                  <span className="font-mono font-bold">
                    {projectedCatSpent.toLocaleString('vi-VN')} ₫
                  </span>{' '}
                  (vượt hạn mức{' '}
                  <span className="font-mono font-bold">
                    +{(projectedCatSpent - catLimit).toLocaleString('vi-VN')} ₫
                  </span>
                  ).
                </div>
              )}
              {isCatNear && targetCat && (
                <div>
                  Mục <strong>{targetCat.shortName}</strong> sẽ đạt{' '}
                  <span className="font-mono font-bold">
                    {Math.round((projectedCatSpent / catLimit) * 100)}%
                  </span>{' '}
                  hạn mức ({projectedCatSpent.toLocaleString('vi-VN')} / {catLimit.toLocaleString('vi-VN')} ₫).
                </div>
              )}
              {isTotalOver && (
                <div>
                  Tổng chi toàn tour sẽ vượt tổng ngân sách{' '}
                  <span className="font-mono font-bold">
                    +{(projectedTotalSpent - totalBudget).toLocaleString('vi-VN')} ₫
                  </span>
                  .
                </div>
              )}
            </div>
          </div>
        )}

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
              onChange={(e) => onDateChange(e.target.value)}
            />
          </Field>

          <Field label="Thuộc Ngày tour">
            <SelectInput
              value={dayIndex}
              onChange={(e) => onDayIndexChange(Number(e.target.value))}
            >
              {trip.days.map((d) => (
                <option key={d.dayIndex} value={d.dayIndex}>
                  Ngày {d.dayIndex} ({d.dayName})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {matchedDayForDate === null && date && (
          <p className="text-[11px] text-neutral-500 -mt-2">
            Ngày lập hóa đơn nằm ngoài khoảng ngày tour — hóa đơn vẫn được hạch toán vào <strong>Ngày {dayIndex}</strong>.
          </p>
        )}

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
          <label className="block font-bold text-neutral-700">Ảnh chứng từ / Hóa đơn giấy</label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-blue-400 bg-blue-50/70 hover:bg-blue-100/70 text-blue-800 font-bold cursor-pointer transition">
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
                className="text-red-600 font-bold hover:underline cursor-pointer"
              >
                Gỡ ảnh
              </button>
            )}
          </div>
          {receiptUploadError && (
            <p className="text-[11px] text-red-600 font-semibold">{receiptUploadError}</p>
          )}
          {(receiptImage || receiptId) && (
            <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 p-1.5">
              <ReceiptImage
                tripId={trip.id}
                receiptId={receiptId}
                receiptImage={receiptImage}
                alt="Xem trước ảnh chứng từ"
                className="max-h-40 w-full object-contain rounded-lg"
              />
              {receiptId && (
                <p className="text-[10px] text-blue-700 font-semibold mt-1 text-center">
                  Ảnh đã lưu tách riêng trên máy chủ (không tốn dung lượng lịch trình)
                </p>
              )}
            </div>
          )}
        </div>

        <ModalFooter
          onCancel={onClose}
          cancelDisabled={isSavingInvoice}
          disabled={isUploadingReceipt || isSavingInvoice || isCreateBlockedByLimit}
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
