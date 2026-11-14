import React, { useState } from 'react';
import type { ExpenseInvoice, TripData } from '../../../types/travel';
import { buildExpenseReportCsv } from '../../../utils/tripHelpers';
import { authenticatedFetch, safeJsonResponse } from '../../../api';
import { receiptImageCache } from './ReceiptImage';

interface UseBudgetActionsOptions {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void;
  totalActivityCosts: number;
  invoicesList: ExpenseInvoice[];
  totalBudget: number;
  spentBudget: number;
}

export function useBudgetActions(options: UseBudgetActionsOptions) {
  const { trip, onUpdateTripBudget, totalActivityCosts, invoicesList, totalBudget, spentBudget } = options;
  // Modal states
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'activities'>('invoices');

  // New / Edit Invoice form state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invTitle, setInvTitle] = useState('');
  const [invAmount, setInvAmount] = useState<number>(500000);
  const [invCategory, setInvCategory] = useState<'transport' | 'hotel' | 'meal' | 'sightseeing' | 'contingency'>('meal');
  const [invVendor, setInvVendor] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState('2026-10-14');
  const [invDayIndex, setInvDayIndex] = useState<number>(trip.currentDay || 1);
  const [invNote, setInvNote] = useState('');
  const [invReceiptImage, setInvReceiptImage] = useState<string | undefined>(undefined);
  const [invReceiptId, setInvReceiptId] = useState<string | undefined>(undefined);
  const [originalReceiptId, setOriginalReceiptId] = useState<string | undefined>(undefined);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [previewReceiptInvoice, setPreviewReceiptInvoice] = useState<ExpenseInvoice | null>(null);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);

  const resetInvoiceForm = () => {
    setEditingInvoiceId(null);
    setInvTitle('');
    setInvAmount(500000);
    setInvCategory('meal');
    setInvVendor('');
    setInvNumber('');
    setInvDate(new Date().toISOString().slice(0, 10));
    setInvDayIndex(trip.currentDay || 1);
    setInvNote('');
    setInvReceiptImage(undefined);
    setInvReceiptId(undefined);
    setOriginalReceiptId(undefined);
    setIsUploadingReceipt(false);
    setIsSavingInvoice(false);
    setReceiptUploadError(null);
  };

  const openCreateInvoiceModal = () => {
    resetInvoiceForm();
    setIsInvoiceModalOpen(true);
  };

  const openEditInvoiceModal = (inv: ExpenseInvoice) => {
    setEditingInvoiceId(inv.id);
    setInvTitle(inv.title);
    setInvAmount(inv.amount);
    setInvCategory(inv.category);
    setInvVendor(inv.vendor || '');
    setInvNumber(inv.invoiceNumber || '');
    setInvDate(inv.date || new Date().toISOString().slice(0, 10));
    setInvDayIndex(inv.dayIndex || trip.currentDay || 1);
    setInvNote(inv.note || '');
    setInvReceiptImage(inv.receiptImage);
    setInvReceiptId(inv.receiptId);
    setOriginalReceiptId(inv.receiptId);
    setIsUploadingReceipt(false);
    setIsSavingInvoice(false);
    setReceiptUploadError(null);
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

      // Nén ảnh tối đa 800px và nhắm mục tiêu <= 95KB để tải nhanh và không làm phình tài liệu chuyến đi
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

      // Chỉ nén và giữ tạm trong form; chỉ tải lên kho chứng từ khi người dùng nhấn Lưu để không tạo bản ghi mồ côi nếu hủy hoặc chọn lại ảnh.
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

    setIsSavingInvoice(true);
    setReceiptUploadError(null);
    let finalReceiptId = invReceiptId || undefined;
    let finalReceiptImage = finalReceiptId ? undefined : invReceiptImage;

    try {
      // Nếu có ảnh mới chọn (inline) và đang trực tuyến -> tải lên kho chứng từ riêng ngay trước khi lưu hóa đơn
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

      const invoiceRecord: ExpenseInvoice = {
        id: editingInvoiceId || `inv-${Date.now()}`,
        title: invTitle.trim(),
        category: invCategory,
        amount: invAmount,
        date: invDate,
        vendor: invVendor.trim() || undefined,
        invoiceNumber: invNumber.trim() || undefined,
        dayIndex: invDayIndex,
        note: invNote.trim() || undefined,
        receiptId: finalReceiptId,
        receiptImage: finalReceiptId ? undefined : finalReceiptImage,
        updatedAt: new Date().toISOString(),
      };

      const updatedInvoices = editingInvoiceId
        ? invoicesList.map((item) => (item.id === editingInvoiceId ? invoiceRecord : item))
        : [invoiceRecord, ...invoicesList];

      const updatedInvoicesTotal = updatedInvoices.reduce((sum, item) => sum + (item.amount || 0), 0);
      const newSpent = totalActivityCosts + updatedInvoicesTotal;
      const newRemaining = Math.max(0, totalBudget - newSpent);
      const newPercent = totalBudget > 0 ? Math.min(100, Math.round((newSpent / totalBudget) * 100)) : 0;

      const updatedTrip: TripData = {
        ...trip,
        invoices: updatedInvoices,
        budgetUsed: newSpent,
        budgetRemaining: newRemaining,
        budgetUsedPercent: newPercent,
      };

      // Nếu đang sửa hóa đơn mà ảnh chứng từ cũ đã bị gỡ hoặc thay bằng receiptId khác -> xóa bản ghi chứng từ cũ trên máy chủ
      if (
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

      if (onUpdateTripBudget) {
        onUpdateTripBudget(updatedTrip);
      }

      resetInvoiceForm();
      setIsInvoiceModalOpen(false);
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
  const handleDeleteInvoice = (id: string) => {
    const updatedInvoices = invoicesList.filter((i) => i.id !== id);
    const deletedInv = invoicesList.find((i) => i.id === id);
    const deletedAmount = deletedInv?.amount || 0;
    const newSpent = Math.max(0, spentBudget - deletedAmount);
    const newRemaining = Math.max(0, totalBudget - newSpent);
    const newPercent = Math.round((newSpent / totalBudget) * 100);

    const updatedTrip: TripData = {
      ...trip,
      invoices: updatedInvoices,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (deletedInv?.receiptId && (typeof navigator === 'undefined' || navigator.onLine)) {
      receiptImageCache.delete(`${trip.id}:${deletedInv.receiptId}`);
      void authenticatedFetch(
        `/api/trips/${encodeURIComponent(trip.id)}/receipts/${encodeURIComponent(deletedInv.receiptId)}`,
        { method: 'DELETE' },
      ).catch(() => {});
    }

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
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
    setInvDate,
    invDayIndex,
    setInvDayIndex,
    invNote,
    setInvNote,
    invReceiptImage,
    setInvReceiptImage,
    invReceiptId,
    setInvReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
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
