import React, { useEffect, useState } from 'react';
import { MAX_INVOICES_PER_TRIP } from '../../../utils/trip/normalizeTripData';
import type { ExpenseInvoice, TripData } from '../../../types/travel';
import {
  computeTripBudgetSummaryFields,
  getIsoDateForTripDay,
  getTripDayIndexForIsoDate,
} from '../../../utils/trip/budgetAlerts';
import { buildExpenseReportCsv } from '../../../utils/trip/tripHelpers';
import { authenticatedFetch, safeJsonResponse } from '../../../api';
import { receiptImageCache } from './ReceiptImage';

interface UseBudgetActionsOptions {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void | boolean | Promise<void | boolean>;
  invoicesList: ExpenseInvoice[];
}

const ACTIVITY_TYPE_TO_INVOICE_CATEGORY: Record<string, ExpenseInvoice['category']> = {
  transport: 'transport',
  hotel: 'hotel',
  checkin: 'hotel',
  meal: 'meal',
  sightseeing: 'sightseeing',
};

export function useBudgetActions(options: UseBudgetActionsOptions) {
  const { trip, onUpdateTripBudget, invoicesList } = options;
  // Modal states
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'activities'>('invoices');

  const defaultDayIndex = trip.currentDay || 1;

  // New / Edit Invoice form state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invTitle, setInvTitle] = useState('');
  const [invAmount, setInvAmountState] = useState<number>(500000);
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const setInvAmount: React.Dispatch<React.SetStateAction<number>> = (val) => {
    setHasEditedAmount(true);
    setInvAmountState(val);
  };
  const [invCategory, setInvCategory] = useState<ExpenseInvoice['category']>('meal');
  const [invVendor, setInvVendor] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(() => getIsoDateForTripDay(trip, defaultDayIndex));
  const [invDayIndex, setInvDayIndex] = useState<number>(defaultDayIndex);
  const [invLinkedActivityId, setInvLinkedActivityId] = useState<string | undefined>(undefined);
  const [invNote, setInvNote] = useState('');
  const [invReceiptImage, setInvReceiptImage] = useState<string | undefined>(undefined);
  const [invReceiptId, setInvReceiptId] = useState<string | undefined>(undefined);
  const [originalReceiptId, setOriginalReceiptId] = useState<string | undefined>(undefined);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [previewReceiptInvoice, setPreviewReceiptInvoice] = useState<ExpenseInvoice | null>(null);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);

  const invoiceLimitReached = invoicesList.length >= MAX_INVOICES_PER_TRIP;

  const resetInvoiceForm = () => {
    const startDay = trip.currentDay || 1;
    setEditingInvoiceId(null);
    setInvTitle('');
    setInvAmountState(500000);
    setHasEditedAmount(false);
    setInvCategory('meal');
    setInvVendor('');
    setInvNumber('');
    setInvDate(getIsoDateForTripDay(trip, startDay));
    setInvDayIndex(startDay);
    setInvLinkedActivityId(undefined);
    setInvNote('');
    setInvReceiptImage(undefined);
    setInvReceiptId(undefined);
    setOriginalReceiptId(undefined);
    setIsUploadingReceipt(false);
    setIsSavingInvoice(false);
    setReceiptUploadError(null);
    setInvoiceError(null);
  };

  useEffect(() => {
    setIsInvoiceModalOpen(false);
    setPreviewReceiptInvoice(null);
    setIsReportPreviewOpen(false);
    resetInvoiceForm();
  }, [trip.id]);

  const handleDayIndexChange = (nextDay: number) => {
    const clampedDay = Math.max(1, Math.min(nextDay || 1, trip.days.length || 1));
    setInvDayIndex(clampedDay);
    setInvDate(getIsoDateForTripDay(trip, clampedDay));
  };

  const handleDateChange = (nextDate: string) => {
    setInvDate(nextDate);
    const matchedDay = getTripDayIndexForIsoDate(trip, nextDate);
    if (matchedDay !== null) {
      setInvDayIndex(matchedDay);
    }
  };

  const handleLinkedActivityChange = (nextActivityId: string) => {
    const cleanId = nextActivityId.trim() || undefined;
    setInvLinkedActivityId(cleanId);
    if (!cleanId) return;

    for (const day of trip.days || []) {
      const found = (day.activities || []).find((a) => a.id === cleanId);
      if (found) {
        setInvDayIndex(day.dayIndex);
        setInvDate(getIsoDateForTripDay(trip, day.dayIndex));
        const mappedCat = ACTIVITY_TYPE_TO_INVOICE_CATEGORY[found.type];
        if (mappedCat) {
          setInvCategory(mappedCat);
        }
        if (!editingInvoiceId) {
          if (!invTitle.trim()) {
            setInvTitle(found.title);
          }
          if (!hasEditedAmount && (found.cost || 0) > 0) {
            setInvAmountState(Math.round(found.cost || 0));
          }
        }
        break;
      }
    }
  };

  const openCreateInvoiceModal = () => {
    resetInvoiceForm();
    if (invoiceLimitReached) {
      setInvoiceError(
        `Chuyến đi đã đạt tối đa ${MAX_INVOICES_PER_TRIP} hóa đơn. Hãy chỉnh sửa hoặc xóa bớt hóa đơn cũ trước khi thêm mới.`,
      );
    }
    setIsInvoiceModalOpen(true);
  };

  const openEditInvoiceModal = (inv: ExpenseInvoice) => {
    const resolvedDay = inv.dayIndex || trip.currentDay || 1;
    setEditingInvoiceId(inv.id);
    setInvTitle(inv.title);
    setInvAmountState(inv.amount);
    setHasEditedAmount(true);
    setInvCategory(inv.category);
    setInvVendor(inv.vendor || '');
    setInvNumber(inv.invoiceNumber || '');
    setInvDate(inv.date || getIsoDateForTripDay(trip, resolvedDay));
    setInvDayIndex(resolvedDay);
    setInvLinkedActivityId(inv.linkedActivityId || undefined);
    setInvNote(inv.note || '');
    setInvReceiptImage(inv.receiptImage);
    setInvReceiptId(inv.receiptId);
    setOriginalReceiptId(inv.receiptId);
    setIsUploadingReceipt(false);
    setIsSavingInvoice(false);
    setReceiptUploadError(null);
    setInvoiceError(null);
    setIsInvoiceModalOpen(true);
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReceiptUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setReceiptUploadError('Vui lòng chọn tệp hình ảnh (JPG, PNG, WebP).');
      return;
    }

    setIsUploadingReceipt(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
        reader.readAsDataURL(file);
      });

      const compressed = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.72;
          let out = canvas.toDataURL('image/jpeg', quality);
          while (out.length > 95_000 && quality > 0.35) {
            quality -= 0.1;
            out = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(out);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });

      if (compressed.length > 180_000) {
        setReceiptUploadError('Ảnh chứng từ vẫn quá lớn sau khi nén (>180KB). Vui lòng chọn ảnh nhẹ hơn.');
        return;
      }

      setInvReceiptId(undefined);
      setInvReceiptImage(compressed);
    } catch {
      setReceiptUploadError('Không thể xử lý tệp ảnh chứng từ.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Handle Create or Update Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invTitle.trim() || invAmount <= 0 || isUploadingReceipt || isSavingInvoice) return;

    if (!editingInvoiceId && invoicesList.length >= MAX_INVOICES_PER_TRIP) {
      setInvoiceError(
        `Đã đạt giới hạn tối đa ${MAX_INVOICES_PER_TRIP} hóa đơn cho mỗi chuyến đi. Vui lòng xóa bớt hóa đơn cũ trước khi thêm mới.`,
      );
      return;
    }

    setIsSavingInvoice(true);
    setReceiptUploadError(null);
    setInvoiceError(null);
    let finalReceiptId = invReceiptId || undefined;
    let finalReceiptImage = finalReceiptId ? undefined : invReceiptImage;

    try {
      if (finalReceiptImage && (typeof navigator === 'undefined' || navigator.onLine)) {
        try {
          const res = await authenticatedFetch(`/api/trips/${encodeURIComponent(trip.id)}/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: finalReceiptImage }),
          });
          const payload = await safeJsonResponse(res);
          if (res.ok && payload?.receiptId) {
            receiptImageCache.set(`${trip.id}:${payload.receiptId}`, finalReceiptImage);
            finalReceiptId = payload.receiptId;
            finalReceiptImage = undefined;
          }
        } catch {
          // Giữ inline nếu tải lên lỗi mạng tạm thời; hàng đợi đồng bộ sẽ thử lại khi lưu chuyến đi
        }
      }

      const cleanAmount = Math.round(invAmount);
      const invoiceRecord: ExpenseInvoice = {
        id: editingInvoiceId || `inv-${Date.now()}`,
        title: invTitle.trim(),
        category: invCategory,
        amount: cleanAmount,
        date: invDate,
        vendor: invVendor.trim() || undefined,
        invoiceNumber: invNumber.trim() || undefined,
        dayIndex: invDayIndex,
        linkedActivityId: invLinkedActivityId || undefined,
        note: invNote.trim() || undefined,
        receiptId: finalReceiptId,
        receiptImage: finalReceiptId ? undefined : finalReceiptImage,
        updatedAt: new Date().toISOString(),
      };

      const updatedInvoices = editingInvoiceId
        ? invoicesList.map((item) => (item.id === editingInvoiceId ? invoiceRecord : item))
        : [invoiceRecord, ...invoicesList];

      const draftTrip: TripData = {
        ...trip,
        invoices: updatedInvoices,
      };
      const updatedTrip: TripData = {
        ...draftTrip,
        ...computeTripBudgetSummaryFields(draftTrip),
      };

      const syncedToServer = onUpdateTripBudget ? (await onUpdateTripBudget(updatedTrip)) !== false : true;

      if (
        syncedToServer &&
        editingInvoiceId &&
        originalReceiptId &&
        originalReceiptId !== finalReceiptId &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        receiptImageCache.delete(`${trip.id}:${originalReceiptId}`);
        void authenticatedFetch(
          `/api/trips/${encodeURIComponent(trip.id)}/receipts/${encodeURIComponent(originalReceiptId)}`,
          { method: 'DELETE' },
        ).catch(() => {});
      }

      resetInvoiceForm();
      setIsInvoiceModalOpen(false);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Không thể lưu hóa đơn. Vui lòng thử lại.');
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleExportCsv = () => {
    const csv = buildExpenseReportCsv(trip);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-chi-tieu-${trip.code || trip.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    const updatedInvoices = invoicesList.filter((i) => i.id !== id);
    const deletedInv = invoicesList.find((i) => i.id === id);

    const draftTrip: TripData = {
      ...trip,
      invoices: updatedInvoices,
    };
    const updatedTrip: TripData = {
      ...draftTrip,
      ...computeTripBudgetSummaryFields(draftTrip),
    };

    try {
      const syncedToServer = onUpdateTripBudget ? (await onUpdateTripBudget(updatedTrip)) !== false : true;
      if (syncedToServer && deletedInv?.receiptId && (typeof navigator === 'undefined' || navigator.onLine)) {
        receiptImageCache.delete(`${trip.id}:${deletedInv.receiptId}`);
        void authenticatedFetch(
          `/api/trips/${encodeURIComponent(trip.id)}/receipts/${encodeURIComponent(deletedInv.receiptId)}`,
          { method: 'DELETE' },
        ).catch(() => {});
      }
    } catch (error) {
      // Giữ nguyên chứng từ nếu lưu chuyến đi thất bại để tránh mồ côi dữ liệu
      console.error('Không thể xóa hóa đơn:', error);
    }
  };

  return {
    isInvoiceModalOpen,
    setIsInvoiceModalOpen,
    activeTab,
    setActiveTab,
    editingInvoiceId,
    invTitle,
    setInvTitle,
    invAmount,
    setInvAmount,
    invCategory,
    setInvCategory,
    invVendor,
    setInvVendor,
    invNumber,
    setInvNumber,
    invDate,
    handleDateChange,
    invDayIndex,
    handleDayIndexChange,
    invLinkedActivityId,
    handleLinkedActivityChange,
    invNote,
    setInvNote,
    invReceiptImage,
    setInvReceiptImage,
    invReceiptId,
    setInvReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
    invoiceError,
    invoiceLimitReached,
    previewReceiptInvoice,
    setPreviewReceiptInvoice,
    isReportPreviewOpen,
    setIsReportPreviewOpen,
    resetInvoiceForm,
    openCreateInvoiceModal,
    openEditInvoiceModal,
    handleReceiptFileChange,
    handleSaveInvoice,
    handleExportCsv,
    handleDeleteInvoice,
  };
}
