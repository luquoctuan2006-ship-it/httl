import type { BudgetCategory } from '../components/trips/budget/types';
import type { Activity, ExpenseInvoice, OperationalAlert, TripData } from '../types/travel';
import { parseTripDatesRange } from './tripSyncHelpers';

export const BUDGET_NEAR_LIMIT_RATIO = 0.85;
export const BUDGET_ALERT_ID_PREFIX = 'alert-budget-';

export type BudgetCategoryId = BudgetCategory['id'];

export const BUDGET_CATEGORY_CONFIGS: Array<{
  id: BudgetCategoryId;
  name: string;
  shortName: string;
  defaultRatio: number;
  activityTypes: string[];
}> = [
  {
    id: 'transport',
    name: 'Vận chuyển & Thuê xe di chuyển',
    shortName: 'Vận chuyển & Thuê xe',
    defaultRatio: 0.28,
    activityTypes: ['transport'],
  },
  {
    id: 'hotel',
    name: 'Khách sạn, Resort & Lưu trú',
    shortName: 'Khách sạn & Lưu trú',
    defaultRatio: 0.35,
    activityTypes: ['hotel', 'checkin'],
  },
  {
    id: 'meal',
    name: 'Ăn uống & Nhà hàng ẩm thực địa phương',
    shortName: 'Ẩm thực & Nhà hàng',
    defaultRatio: 0.22,
    activityTypes: ['meal'],
  },
  {
    id: 'sightseeing',
    name: 'Vé tham quan, Cáp treo & Trải nghiệm',
    shortName: 'Vé tham quan & Trải nghiệm',
    defaultRatio: 0.10,
    activityTypes: ['sightseeing'],
  },
  {
    id: 'contingency',
    name: 'Dự phòng rủi ro & Bảo hiểm du lịch',
    shortName: 'Dự phòng & Bảo hiểm',
    defaultRatio: 0.05,
    // Hoạt động briefing (điều hành/tập trung) không phải khoản chi dịch vụ dự phòng 5%
    activityTypes: [],
  },
];

export type ResolvedCategoryAllocations = Record<BudgetCategoryId, number>;

const CATEGORY_CONFIG_BY_ACTIVITY_TYPE = new Map<string, BudgetCategoryId>();
for (const cfg of BUDGET_CATEGORY_CONFIGS) {
  for (const t of cfg.activityTypes) {
    CATEGORY_CONFIG_BY_ACTIVITY_TYPE.set(t, cfg.id);
  }
}

export function resolveCategoryAllocations(trip: TripData): ResolvedCategoryAllocations {
  const totalBudget =
    typeof trip.budgetTotal === 'number' && Number.isFinite(trip.budgetTotal) && trip.budgetTotal > 0
      ? Math.round(trip.budgetTotal)
      : 0;
  const custom = trip.customCategoryAllocations;

  const pick = (key: BudgetCategoryId, ratio: number) => {
    const raw = custom?.[key];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      return Math.round(raw);
    }
    return Math.round(totalBudget * ratio);
  };

  const allocations = {
    transport: pick('transport', 0.28),
    hotel: pick('hotel', 0.35),
    meal: pick('meal', 0.22),
    sightseeing: pick('sightseeing', 0.10),
    contingency: pick('contingency', 0.05),
  };

  return totalBudget > 0 ? capCategoryAllocationsToBudget(allocations, totalBudget) : allocations;
}

function capCategoryAllocationsToBudget(
  allocations: ResolvedCategoryAllocations,
  budgetTotal: number,
): ResolvedCategoryAllocations {
  const keys: BudgetCategoryId[] = ['transport', 'hotel', 'meal', 'sightseeing', 'contingency'];
  const budget = Math.max(0, Math.round(budgetTotal));
  const total = keys.reduce((sum, key) => sum + allocations[key], 0);
  if (total <= budget || total === 0) return allocations;

  const scaled: ResolvedCategoryAllocations = {
    transport: Math.round((allocations.transport / total) * budget),
    hotel: Math.round((allocations.hotel / total) * budget),
    meal: Math.round((allocations.meal / total) * budget),
    sightseeing: Math.round((allocations.sightseeing / total) * budget),
    contingency: Math.round((allocations.contingency / total) * budget),
  };
  let excess = keys.reduce((sum, key) => sum + scaled[key], 0) - budget;
  for (const key of [...keys].sort((a, b) => scaled[b] - scaled[a])) {
    if (excess <= 0) break;
    const reduction = Math.min(scaled[key], excess);
    scaled[key] -= reduction;
    excess -= reduction;
  }
  return scaled;
}

export function resolveInitialTripCategoryAllocations(
  trip: TripData,
): TripData['customCategoryAllocations'] | undefined {
  const budget =
    typeof trip.budgetTotal === 'number' && Number.isFinite(trip.budgetTotal) && trip.budgetTotal > 0
      ? Math.round(trip.budgetTotal)
      : 0;
  if (budget <= 0) return trip.customCategoryAllocations;

  const current = resolveCategoryAllocations(trip);
  const metrics = computeBudgetMetrics(trip);
  const spendByCategory = Object.fromEntries(
    metrics.categories.map((category) => [category.id, category.spent]),
  ) as ResolvedCategoryAllocations;
  const totalSpent = Object.values(spendByCategory).reduce((sum, amount) => sum + amount, 0);

  if (totalSpent <= 0) {
    return trip.customCategoryAllocations
      ? capCategoryAllocationsToBudget(current, budget)
      : undefined;
  }
  if (totalSpent > budget) {
    return capCategoryAllocationsToBudget(current, budget);
  }

  const currentTotal = Object.values(current).reduce((sum, amount) => sum + amount, 0);
  const remainingBudget = budget - totalSpent;
  const allocations = {} as ResolvedCategoryAllocations;
  const fractionalShares: Array<{ id: BudgetCategoryId; fraction: number }> = [];
  for (const category of BUDGET_CATEGORY_CONFIGS) {
    const weight =
      currentTotal > 0
        ? current[category.id] / currentTotal
        : category.defaultRatio;
    const exactShare = remainingBudget * weight;
    const wholeShare = Math.floor(exactShare);
    allocations[category.id] = spendByCategory[category.id] + wholeShare;
    fractionalShares.push({ id: category.id, fraction: exactShare - wholeShare });
  }

  let unallocated = budget - Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  for (const share of fractionalShares.sort((a, b) => b.fraction - a.fraction)) {
    if (unallocated <= 0) break;
    allocations[share.id] += 1;
    unallocated -= 1;
  }
  return allocations;
}

/**
 * Co giãn tỷ lệ phân bổ tùy chỉnh tương ứng khi người dùng thay đổi tổng hạn mức ngân sách,
 * đảm bảo tổng phân bổ không vượt quá tổng hạn mức mới do sai số làm tròn.
 */
export function resolveScaledAllocationsForBudget(
  trip: TripData,
  newBudgetTotal: number,
): TripData['customCategoryAllocations'] | undefined {
  if (!trip.customCategoryAllocations) return undefined;
  const cleanNewBudget = Math.max(0, Math.round(newBudgetTotal));
  const current = resolveCategoryAllocations(trip);
  const oldTotal =
    typeof trip.budgetTotal === 'number' && Number.isFinite(trip.budgetTotal) && trip.budgetTotal > 0
      ? Math.round(trip.budgetTotal)
      : current.transport + current.hotel + current.meal + current.sightseeing + current.contingency;

  if (oldTotal <= 0 || cleanNewBudget <= 0) {
    return trip.customCategoryAllocations;
  }

  const ratio = cleanNewBudget / oldTotal;
  const scaled: ResolvedCategoryAllocations = {
    transport: Math.round(current.transport * ratio),
    hotel: Math.round(current.hotel * ratio),
    meal: Math.round(current.meal * ratio),
    sightseeing: Math.round(current.sightseeing * ratio),
    contingency: Math.round(current.contingency * ratio),
  };

  return capCategoryAllocationsToBudget(scaled, cleanNewBudget);
}

export function getIsoDateForTripDay(trip: Pick<TripData, 'dates' | 'totalDays' | 'days'>, dayIndex: number): string {
  const daysLen = Array.isArray(trip.days) && trip.days.length > 0 ? trip.days.length : trip.totalDays || 1;
  const { startDate } = parseTripDatesRange(trip.dates, daysLen);
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return startDate;
  const dt = new Date(Date.UTC(y, m - 1, d + Math.max(0, Math.round(dayIndex) - 1)));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTripDayIndexForIsoDate(
  trip: Pick<TripData, 'dates' | 'totalDays' | 'days'>,
  isoDate: string,
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const daysLen = Array.isArray(trip.days) && trip.days.length > 0 ? trip.days.length : trip.totalDays || 1;
  const { startDate } = parseTripDatesRange(trip.dates, daysLen);
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [iy, im, id] = isoDate.split('-').map(Number);
  if (!sy || !sm || !sd || !iy || !im || !id) return null;
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const invUtc = Date.UTC(iy, im - 1, id);
  const diffDays = Math.round((invUtc - startUtc) / 86_400_000);
  if (diffDays < 0 || diffDays >= daysLen) return null;
  return diffDays + 1;
}

export interface ComputedBudgetMetrics {
  currentAllocations: ResolvedCategoryAllocations;
  totalAllocatedSum: number;
  allActivities: Activity[];
  linkedActivityIds: Set<string>;
  totalActivityCosts: number;
  deduplicatedActivityCosts: number;
  actualSpentBudget: number;
  plannedCommittedBudget: number;
  pendingApprovalBudget: number;
  pendingApprovalCount: number;
  invoicesList: ExpenseInvoice[];
  totalInvoicesCosts: number;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  overBudgetAmount: number;
  rawPercentUsed: number;
  percentUsed: number;
  isOverTotalBudget: boolean;
  isNearTotalBudget: boolean;
  categories: BudgetCategory[];
}

export function computeBudgetMetrics(trip: TripData): ComputedBudgetMetrics {
  const currentAllocations = resolveCategoryAllocations(trip);
  const allActivities = (trip.days || []).flatMap((d) => d.activities || []);
  const validActivityIds = new Set(allActivities.map((a) => a.id));

  const invoicesList: ExpenseInvoice[] = Array.isArray(trip.invoices) ? trip.invoices : [];
  const totalInvoicesCosts = invoicesList.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Hoạt động đã được liên kết với hóa đơn thực tế sẽ dùng số tiền hóa đơn, tránh tính trùng chi phí
  const linkedActivityIds = new Set(
    invoicesList
      .map((inv) => inv.linkedActivityId)
      .filter((id): id is string => Boolean(id && validActivityIds.has(id))),
  );

  // Hoạt động "Chờ duyệt" chưa được chốt nên không cộng vào ngân sách đã sử dụng
  const billableUnlinkedActivities = allActivities.filter(
    (a) =>
      a.status !== 'Chờ duyệt' &&
      !linkedActivityIds.has(a.id) &&
      CATEGORY_CONFIG_BY_ACTIVITY_TYPE.has(a.type),
  );

  const pendingApprovalActivities = allActivities.filter(
    (a) =>
      a.status === 'Chờ duyệt' &&
      !linkedActivityIds.has(a.id) &&
      CATEGORY_CONFIG_BY_ACTIVITY_TYPE.has(a.type) &&
      (a.cost || 0) > 0,
  );

  const completedActivityCosts = billableUnlinkedActivities
    .filter((a) => a.status === 'Hoàn tất')
    .reduce((sum, a) => sum + (a.cost || 0), 0);

  const plannedCommittedBudget = Math.max(
    0,
    Math.round(
      billableUnlinkedActivities
        .filter((a) => a.status !== 'Hoàn tất')
        .reduce((sum, a) => sum + (a.cost || 0), 0),
    ),
  );

  const actualSpentBudget = Math.max(0, Math.round(totalInvoicesCosts + completedActivityCosts));
  const pendingApprovalBudget = Math.max(
    0,
    Math.round(pendingApprovalActivities.reduce((sum, a) => sum + (a.cost || 0), 0)),
  );
  const pendingApprovalCount = pendingApprovalActivities.length;

  const deduplicatedActivityCosts = Math.max(0, Math.round(completedActivityCosts + plannedCommittedBudget));
  const totalActivityCosts = deduplicatedActivityCosts;

  const totalBudget =
    typeof trip.budgetTotal === 'number' && Number.isFinite(trip.budgetTotal) && trip.budgetTotal > 0
      ? Math.round(trip.budgetTotal)
      : 0;
  const spentBudget = Math.max(0, Math.round(deduplicatedActivityCosts + totalInvoicesCosts));
  const remainingBudget = Math.max(0, totalBudget - spentBudget);
  const overBudgetAmount = totalBudget > 0 ? Math.max(0, spentBudget - totalBudget) : 0;
  const rawPercentUsed = totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 100) : 0;
  const percentUsed = Math.min(rawPercentUsed, 100);
  const isOverTotalBudget = totalBudget > 0 && spentBudget > totalBudget;
  const isNearTotalBudget =
    totalBudget > 0 && !isOverTotalBudget && spentBudget >= totalBudget * BUDGET_NEAR_LIMIT_RATIO;

  const categories: BudgetCategory[] = BUDGET_CATEGORY_CONFIGS.map((cat) => {
    const catActivities = billableUnlinkedActivities.filter((a) => cat.activityTypes.includes(a.type));
    const catInvoices = invoicesList.filter((inv) => inv.category === cat.id);
    const actSum = catActivities.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invSum = catInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const spent = Math.max(0, Math.round(actSum + invSum));
    const allocated = currentAllocations[cat.id];
    const hasExplicitZeroLimit =
      typeof trip.customCategoryAllocations?.[cat.id] === 'number' && allocated === 0;

    const rawPercent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    const percent = allocated > 0 ? Math.min(rawPercent, 100) : spent > 0 && hasExplicitZeroLimit ? 100 : 0;
    const remaining = Math.max(0, allocated - spent);
    const overAmount = allocated > 0 || hasExplicitZeroLimit ? Math.max(0, spent - allocated) : 0;

    let status: BudgetCategory['status'] = 'Dự kiến';
    let level: BudgetCategory['level'] = 'idle';

    if ((allocated > 0 && spent > allocated) || (hasExplicitZeroLimit && spent > 0)) {
      status = 'Vượt hạn mức';
      level = 'over';
    } else if (allocated > 0 && spent === allocated) {
      status = 'Đạt 100% hạn mức';
      level = 'near';
    } else if (allocated > 0 && spent >= allocated * BUDGET_NEAR_LIMIT_RATIO) {
      status = 'Sắp chạm mức';
      level = 'near';
    } else if (spent > 0) {
      status = 'Đang dùng';
      level = 'normal';
    }

    return {
      id: cat.id,
      name: cat.name,
      shortName: cat.shortName,
      allocated,
      spent,
      rawPercent,
      percent,
      remaining,
      overAmount,
      status,
      level,
      count: catActivities.length + catInvoices.length,
    };
  });

  const totalAllocatedSum =
    currentAllocations.transport +
    currentAllocations.hotel +
    currentAllocations.meal +
    currentAllocations.sightseeing +
    currentAllocations.contingency;

  return {
    currentAllocations,
    totalAllocatedSum,
    allActivities,
    linkedActivityIds,
    totalActivityCosts,
    deduplicatedActivityCosts,
    actualSpentBudget,
    plannedCommittedBudget,
    pendingApprovalBudget,
    pendingApprovalCount,
    invoicesList,
    totalInvoicesCosts,
    totalBudget,
    spentBudget,
    remainingBudget,
    overBudgetAmount,
    rawPercentUsed,
    percentUsed,
    isOverTotalBudget,
    isNearTotalBudget,
    categories,
  };
}

/**
 * Hàm tính toán 4 trường ngân sách tổng hợp duy nhất dùng chung cho client hooks, UI và server.
 */
export function computeTripBudgetSummaryFields(
  trip: TripData,
): Pick<TripData, 'budgetTotal' | 'budgetUsed' | 'budgetRemaining' | 'budgetUsedPercent'> {
  const metrics = computeBudgetMetrics(trip);
  return {
    budgetTotal: metrics.totalBudget,
    budgetUsed: metrics.spentBudget,
    budgetRemaining: metrics.remainingBudget,
    budgetUsedPercent: metrics.percentUsed,
  };
}

export function detectBudgetAlerts(trip: TripData): OperationalAlert[] {
  const metrics = computeBudgetMetrics(trip);
  const alerts: OperationalAlert[] = [];

  if (metrics.isOverTotalBudget) {
    alerts.push({
      id: `${BUDGET_ALERT_ID_PREFIX}total-over-${trip.id}`,
      title: `Vượt tổng ngân sách +${metrics.overBudgetAmount.toLocaleString('vi-VN')} ₫`,
      timeAgo: `${metrics.rawPercentUsed}% dự toán`,
      description: `Tổng chi (gồm ${metrics.actualSpentBudget.toLocaleString('vi-VN')} ₫ thực chi và ${metrics.plannedCommittedBudget.toLocaleString('vi-VN')} ₫ dự kiến lịch trình) đã vượt hạn mức ${metrics.totalBudget.toLocaleString('vi-VN')} ₫.`,
      severity: 'error',
      category: 'budget',
    });
  } else if (metrics.isNearTotalBudget) {
    alerts.push({
      id: `${BUDGET_ALERT_ID_PREFIX}total-near-${trip.id}`,
      title: `Ngân sách sắp chạm hạn mức (${metrics.rawPercentUsed}%)`,
      timeAgo: `Còn ${metrics.remainingBudget.toLocaleString('vi-VN')} ₫`,
      description: `Đã phân bổ sử dụng ${metrics.spentBudget.toLocaleString('vi-VN')} ₫ / ${metrics.totalBudget.toLocaleString('vi-VN')} ₫ (thực chi ${metrics.actualSpentBudget.toLocaleString('vi-VN')} ₫, dự kiến ${metrics.plannedCommittedBudget.toLocaleString('vi-VN')} ₫). Còn lại ${metrics.remainingBudget.toLocaleString('vi-VN')} ₫.`,
      severity: 'warning',
      category: 'budget',
    });
  }

  for (const cat of metrics.categories) {
    if (cat.level === 'over') {
      alerts.push({
        id: `${BUDGET_ALERT_ID_PREFIX}cat-over-${trip.id}-${cat.id}`,
        title: `Vượt hạn mức "${cat.shortName}" (+${cat.overAmount.toLocaleString('vi-VN')} ₫)`,
        timeAgo: cat.allocated > 0 ? `${cat.rawPercent}%` : 'Hạn mức 0 ₫',
        description: `Chi phí hạng mục ${cat.name} đã đạt ${cat.spent.toLocaleString('vi-VN')} ₫, vượt hạn mức ${cat.allocated.toLocaleString('vi-VN')} ₫.`,
        severity: 'error',
        category: 'budget',
      });
    } else if (cat.level === 'near') {
      alerts.push({
        id: `${BUDGET_ALERT_ID_PREFIX}cat-near-${trip.id}-${cat.id}`,
        title: `Sắp chạm mức "${cat.shortName}" (${cat.rawPercent}%)`,
        timeAgo: `Còn ${cat.remaining.toLocaleString('vi-VN')} ₫`,
        description: `Chi phí hạng mục ${cat.name} đã dùng ${cat.spent.toLocaleString('vi-VN')} ₫ / ${cat.allocated.toLocaleString('vi-VN')} ₫.`,
        severity: 'warning',
        category: 'budget',
      });
    }
  }

  return alerts;
}

export function isBudgetAlert(alert: OperationalAlert): boolean {
  return alert.category === 'budget' || alert.id.startsWith(BUDGET_ALERT_ID_PREFIX);
}

/**
 * Đồng bộ các cảnh báo ngân sách (thêm mới, cập nhật số tiền, gỡ cảnh báo đã được khắc phục)
 * mà vẫn giữ nguyên các cảnh báo vận hành/thời tiết khác của chuyến đi.
 */
export function syncBudgetAlertsIntoTrip(trip: TripData): {
  trip: TripData;
  budgetAlerts: OperationalAlert[];
  newlyTriggeredAlerts: OperationalAlert[];
} {
  const existingAlerts = Array.isArray(trip.alerts) ? trip.alerts : [];
  const previousBudgetMap = new Map(
    existingAlerts.filter(isBudgetAlert).map((a) => [a.id, a]),
  );
  const nonBudgetAlerts = existingAlerts.filter((a) => !isBudgetAlert(a));
  const budgetAlerts = detectBudgetAlerts(trip);

  const newlyTriggeredAlerts = budgetAlerts.filter((nextAlert) => {
    const prev = previousBudgetMap.get(nextAlert.id);
    return !prev || prev.title !== nextAlert.title;
  });

  // Đưa cảnh báo vượt ngân sách (error) lên đầu để điều phối viên thấy ngay
  const nextAlerts = [...budgetAlerts, ...nonBudgetAlerts].slice(0, 50);

  return {
    trip: {
      ...trip,
      alerts: nextAlerts,
    },
    budgetAlerts,
    newlyTriggeredAlerts,
  };
}
