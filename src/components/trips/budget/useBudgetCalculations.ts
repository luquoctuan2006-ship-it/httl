import type { TripData } from '../../../types/travel';
import { computeBudgetMetrics, detectBudgetAlerts } from '../../../utils/trip/budgetAlerts';

const INVOICE_CATEGORY_LABELS: Record<string, string> = {
  transport: 'vận chuyển thuê xe di chuyển',
  hotel: 'khách sạn lưu trú nghỉ ngơi',
  meal: 'ẩm thực nhà hàng ăn uống',
  sightseeing: 'vé tham quan cáp treo trải nghiệm',
  contingency: 'dự phòng rủi ro bảo hiểm khác',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  sightseeing: 'tham quan',
  meal: 'ăn uống',
  transport: 'di chuyển xe',
  hotel: 'khách sạn lưu trú',
  checkin: 'check-in nhận phòng',
  briefing: 'điều hành tập trung',
};

export function useBudgetCalculations(trip: TripData, searchQuery: string) {
  const metrics = computeBudgetMetrics(trip);
  const budgetAlerts = detectBudgetAlerts(trip);

  // Filtered expense items
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredInvoices = metrics.invoicesList.filter((inv) => {
    if (!normalizedQuery) return true;
    const catLabel = INVOICE_CATEGORY_LABELS[inv.category] || '';
    return (
      inv.title.toLowerCase().includes(normalizedQuery) ||
      inv.vendor?.toLowerCase().includes(normalizedQuery) ||
      inv.invoiceNumber?.toLowerCase().includes(normalizedQuery) ||
      inv.category.toLowerCase().includes(normalizedQuery) ||
      catLabel.includes(normalizedQuery)
    );
  });

  const expenseActivities = metrics.allActivities.filter((a) => (a.cost || 0) > 0);
  const filteredActivities = expenseActivities.filter((act) => {
    if (!normalizedQuery) return true;
    const typeLabel = ACTIVITY_TYPE_LABELS[act.type] || '';
    return (
      act.title.toLowerCase().includes(normalizedQuery) ||
      act.location.toLowerCase().includes(normalizedQuery) ||
      act.type.toLowerCase().includes(normalizedQuery) ||
      typeLabel.includes(normalizedQuery)
    );
  });

  return {
    ...metrics,
    budgetAlerts,
    expenseActivities,
    filteredInvoices,
    filteredActivities,
  };
}
