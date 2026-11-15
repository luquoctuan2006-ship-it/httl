import type { ExpenseInvoice, TripData } from '../../../types/travel';

export function useBudgetCalculations(trip: TripData, searchQuery: string) {
  const currentAllocations = trip.customCategoryAllocations || {
    transport: Math.round((trip.budgetTotal || 48600000) * 0.28),
    hotel: Math.round((trip.budgetTotal || 48600000) * 0.35),
    meal: Math.round((trip.budgetTotal || 48600000) * 0.22),
    sightseeing: Math.round((trip.budgetTotal || 48600000) * 0.10),
    contingency: Math.round((trip.budgetTotal || 48600000) * 0.05),
  };

  // Flatten all activities
  const allActivities = trip.days.flatMap((d) => d.activities);

  // Activity costs sum
  const totalActivityCosts = allActivities.reduce((sum, a) => sum + (a.cost || 0), 0);

  // Invoices list and sum
  const invoicesList: ExpenseInvoice[] = trip.invoices || [];
  const totalInvoicesCosts = invoicesList.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Dynamic Total Spent and Remaining
  const totalBudget = trip.budgetTotal || 48600000;
  // If invoices exist, spent combines activities + invoices, or uses activity sum
  const spentBudget = totalActivityCosts + totalInvoicesCosts;
  const remainingBudget = Math.max(0, totalBudget - spentBudget);
  const percentUsed = totalBudget > 0 ? Math.min(Math.round((spentBudget / totalBudget) * 100), 100) : 0;

  // Category breakdown calculation
  const categoryConfigs = [
    {
      id: 'transport' as const,
      name: 'Vận chuyển & Thuê xe di chuyển',
      types: ['transport'],
      allocated: currentAllocations.transport || Math.round(totalBudget * 0.28),
    },
    {
      id: 'hotel' as const,
      name: 'Khách sạn, Resort & Lưu trú',
      types: ['hotel', 'checkin'],
      allocated: currentAllocations.hotel || Math.round(totalBudget * 0.35),
    },
    {
      id: 'meal' as const,
      name: 'Ăn uống & Nhà hàng ẩm thực địa phương',
      types: ['meal'],
      allocated: currentAllocations.meal || Math.round(totalBudget * 0.22),
    },
    {
      id: 'sightseeing' as const,
      name: 'Vé tham quan, Cáp treo & Trải nghiệm',
      types: ['sightseeing'],
      allocated: currentAllocations.sightseeing || Math.round(totalBudget * 0.10),
    },
    {
      id: 'contingency' as const,
      name: 'Dự phòng rủi ro & Bảo hiểm du lịch',
      types: ['briefing'],
      allocated: currentAllocations.contingency || Math.round(totalBudget * 0.05),
    },
  ];

  const categories = categoryConfigs.map((cat) => {
    const catActivities = allActivities.filter((a) => cat.types.includes(a.type));
    const catInvoices = invoicesList.filter((inv) => inv.category === cat.id);
    const actSum = catActivities.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invSum = catInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const spent = actSum + invSum;
    const allocated = cat.allocated;
    const percent = allocated > 0 ? Math.min(Math.round((spent / allocated) * 100), 100) : 0;

    let status = 'Dự kiến';
    if (spent >= allocated) {
      status = 'Vượt hạn mức';
    } else if (spent > 0) {
      status = 'Đang dùng';
    }

    return {
      id: cat.id,
      name: cat.name,
      allocated,
      spent,
      percent,
      status,
      count: catActivities.length + catInvoices.length,
    };
  });

  // Filtered expense items
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredInvoices = invoicesList.filter((inv) => {
    if (!normalizedQuery) return true;
    return (
      inv.title.toLowerCase().includes(normalizedQuery) ||
      inv.vendor?.toLowerCase().includes(normalizedQuery) ||
      inv.invoiceNumber?.toLowerCase().includes(normalizedQuery) ||
      inv.category.toLowerCase().includes(normalizedQuery)
    );
  });

  const expenseActivities = allActivities.filter((a) => (a.cost || 0) > 0);
  const filteredActivities = expenseActivities.filter((act) => {
    if (!normalizedQuery) return true;
    return (
      act.title.toLowerCase().includes(normalizedQuery) ||
      act.location.toLowerCase().includes(normalizedQuery) ||
      act.type.toLowerCase().includes(normalizedQuery)
    );
  });

  return {
    currentAllocations, allActivities, totalActivityCosts, invoicesList, totalInvoicesCosts,
    totalBudget, spentBudget, remainingBudget, percentUsed, categories, expenseActivities,
    filteredInvoices, filteredActivities,
  };
}
