import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ExpenseInvoice } from '../../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../../api';

export const receiptImageCache = new Map<string, string>();

export const ReceiptImage: React.FC<{
  tripId: string;
  receiptId?: string;
  receiptImage?: string;
  alt: string;
  className?: string;
}> = ({ tripId, receiptId, receiptImage, alt, className = '' }) => {
  const cacheKey = receiptId ? `${tripId}:${receiptId}` : '';
  const [src, setSrc] = useState<string | undefined>(
    () => receiptImage || (cacheKey ? receiptImageCache.get(cacheKey) : undefined),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (receiptImage) {
      setSrc(receiptImage);
      setFailed(false);
      return;
    }
    if (!receiptId || !tripId) {
      setSrc(undefined);
      return;
    }
    const key = `${tripId}:${receiptId}`;
    const cached = receiptImageCache.get(key);
    if (cached) {
      setSrc(cached);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setFailed(false);
    void (async () => {
      try {
        const res = await authenticatedFetch(
          `/api/trips/${encodeURIComponent(tripId)}/receipts/${encodeURIComponent(receiptId)}`,
        );
        if (!res.ok) throw new Error('Không thể tải ảnh');
        const payload = await safeJsonResponse(res);
        if (!cancelled && typeof payload?.dataUrl === 'string') {
          receiptImageCache.set(key, payload.dataUrl);
          setSrc(payload.dataUrl);
        } else if (!cancelled) {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, receiptId, receiptImage]);

  if (src) return <img src={src} alt={alt} className={className} />;
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-bold ${className}`}>
        Không tải được ảnh
      </div>
    );
  }
  return <div className={`bg-slate-200/80 animate-pulse ${className}`} />;
};

export const ReceiptPreviewModal: React.FC<{
  tripId: string;
  invoice: ExpenseInvoice | null;
  onClose: () => void;
}> = ({ tripId, invoice, onClose }) => {
  if (!invoice || (!invoice.receiptImage && !invoice.receiptId)) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between text-xs">
          <div>
            <h3 className="font-extrabold">{invoice.title}</h3>
            <p className="text-slate-400">
              {invoice.invoiceNumber ? `Số HD: ${invoice.invoiceNumber} • ` : ''}
              {invoice.amount.toLocaleString('vi-VN')} ₫ ({invoice.date})
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[75vh] overflow-auto">
          <ReceiptImage
            tripId={tripId}
            receiptId={invoice.receiptId}
            receiptImage={invoice.receiptImage}
            alt={invoice.title}
            className="max-w-full max-h-[68vh] rounded-xl shadow-md object-contain"
          />
        </div>
      </div>
    </div>
  );
};
