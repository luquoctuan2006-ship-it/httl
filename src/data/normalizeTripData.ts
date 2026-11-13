import { initialTripData } from './mockData';
import { Activity, DaySchedule, TripData, Waypoint, TripMember, OperationalAlert, AISuggestion, ExpenseInvoice } from '../types/travel';

const VALID_STATUSES: Activity['status'][] = ['Hoàn tất', 'Đang diễn ra', 'Cần xử lý', 'Đã xác nhận', 'Chờ duyệt'];
const VALID_TYPES: Activity['type'][] = ['transport', 'meal', 'sightseeing', 'hotel', 'checkin', 'briefing'];

function normalizeActivity(raw: unknown, idx: number, dayIdx: number): Activity {
  const isObject = raw && typeof raw === 'object';
  const item = (isObject ? raw : {}) as Record<string, unknown>;

  const rawId = typeof item.id === 'string' ? item.id.trim() : '';
  const id = rawId.length > 0 ? rawId.slice(0, 128) : `act-${dayIdx}-${idx + 1}`;

  const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
  const title = rawTitle.length > 0 ? rawTitle.slice(0, 200) : `Hoạt động ${idx + 1}`;

  const rawStart = typeof item.timeStart === 'string' ? item.timeStart.trim() : '';
  const hasValidStart = /^\d{1,2}:\d{2}$/.test(rawStart);
  const timeStart = hasValidStart ? rawStart : '08:00';

  const rawEnd = typeof item.timeEnd === 'string' ? item.timeEnd.trim() : '';
  const hasValidEnd = /^\d{1,2}:\d{2}$/.test(rawEnd);
  const timeEnd = hasValidEnd ? rawEnd : '09:30';

  const location = typeof item.location === 'string'
    ? item.location.trim().slice(0, 200)
    : '';

  const hasValidStatus = typeof item.status === 'string' && VALID_STATUSES.includes(item.status as Activity['status']);
  // If activity was corrupted or lacked required fields, set status to 'Chờ duyệt' for human dispatcher review
  const isCorrupted = !isObject || rawTitle.length === 0 || !hasValidStart || !hasValidEnd || !hasValidStatus;
  const status: Activity['status'] = isCorrupted
    ? 'Chờ duyệt'
    : (item.status as Activity['status']);

  const type = VALID_TYPES.includes(item.type as Activity['type'])
    ? (item.type as Activity['type'])
    : 'sightseeing';

  const details = typeof item.details === 'string'
    ? item.details.trim().slice(0, 500)
    : '';

  const cost = typeof item.cost === 'number' && Number.isFinite(item.cost) && item.cost >= 0
    ? item.cost
    : 0;

  const res: Activity = {
    id,
    timeStart,
    timeEnd,
    title,
    location,
    status,
    type,
    details,
    cost,
  };

  if (typeof item.highlight === 'boolean') res.highlight = item.highlight;
  if (typeof item.notes === 'string') res.notes = item.notes.slice(0, 300);
  if (item.coordinates && typeof item.coordinates === 'object') {
    const c = item.coordinates as { lat?: number; lng?: number };
    if (typeof c.lat === 'number' && typeof c.lng === 'number' && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      res.coordinates = { lat: c.lat, lng: c.lng };
    }
  }

  return res;
}

const MAX_DAYS = 30;
const MAX_ACTIVITIES_PER_DAY = 50;

export function normalizeTripData(value: unknown): TripData {
  if (!value || typeof value !== 'object') return structuredClone(initialTripData);

  const candidate = value as Record<string, unknown>;
  const dayNamesCycle = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  // Giới hạn tối đa 30 ngày
  const rawDays = Array.isArray(candidate.days) ? candidate.days.slice(0, MAX_DAYS) : [];

  const days: DaySchedule[] = rawDays.map((dayRaw, idx) => {
    const day = (dayRaw && typeof dayRaw === 'object' ? dayRaw : {}) as Record<string, unknown>;
    const dayIndex = typeof day.dayIndex === 'number' && day.dayIndex > 0 ? day.dayIndex : idx + 1;
    const fallbackDayName = dayNamesCycle[(dayIndex - 1) % 7];
    const dayName = typeof day.dayName === 'string' && day.dayName.trim() ? day.dayName.trim() : fallbackDayName;
    const dateNum = typeof day.dateNum === 'number' ? day.dateNum : dayIndex;
    const fullDate = typeof day.fullDate === 'string' && day.fullDate.trim() ? day.fullDate.trim() : `Ngày ${dayIndex}`;
    const dateLabel = typeof day.dateLabel === 'string' && day.dateLabel.trim() ? day.dateLabel.trim() : `${dayName} ${dateNum}`;

    // Chuẩn hóa và sửa lỗi hoạt động (tối đa 50 hoạt động/ngày), không xóa mất hoạt động
    const rawActs = Array.isArray(day.activities) ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY) : [];
    const activities: Activity[] = rawActs.map((actRaw, actIdx) => normalizeActivity(actRaw, actIdx, dayIndex));

    const confirmedCount = activities.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pendingCount = activities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length;

    return {
      dayIndex,
      dayName,
      dateNum,
      fullDate,
      dateLabel,
      dispatcherNote: typeof day.dispatcherNote === 'string' ? day.dispatcherNote.slice(0, 500) : '',
      activities,
      confirmedCount,
      pendingCount,
      hasWarning: Boolean(day.hasWarning),
    };
  });

  const allActivities = days.flatMap((d) => d.activities);
  const totalActs = allActivities.length;
  const confirmedActs = allActivities.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
  const pendingActs = allActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length;

  const totalDays = typeof candidate.totalDays === 'number' && candidate.totalDays > 0
    ? Math.min(candidate.totalDays, MAX_DAYS)
    : Math.max(days.length, 1);

  const safeCurrentDay = typeof candidate.currentDay === 'number' && days.some((d) => d.dayIndex === candidate.currentDay)
    ? candidate.currentDay
    : (days[0]?.dayIndex ?? 1);

  // Không mượn dữ liệu mẫu của initialTripData khi candidate thiếu budget/members/waypoints/alerts
  const budgetTotal = typeof candidate.budgetTotal === 'number' && Number.isFinite(candidate.budgetTotal) && candidate.budgetTotal >= 0
    ? candidate.budgetTotal
    : 0;

  const budgetUsed = typeof candidate.budgetUsed === 'number' && Number.isFinite(candidate.budgetUsed) && candidate.budgetUsed >= 0
    ? candidate.budgetUsed
    : 0;

  const budgetRemaining = Math.max(0, budgetTotal - budgetUsed);
  const budgetUsedPercent = budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0;

  const id = typeof candidate.id === 'string' && candidate.id.trim()
    ? candidate.id.trim().slice(0, 128)
    : `trip-${Date.now()}`;

  const code = typeof candidate.code === 'string' && candidate.code.trim()
    ? candidate.code.trim().slice(0, 64)
    : 'VN-TOUR';

  const title = typeof candidate.title === 'string' && candidate.title.trim()
    ? candidate.title.trim().slice(0, 200)
    : 'Chuyến đi mới';

  const status = candidate.status === 'Chuẩn bị' || candidate.status === 'Hoàn thành'
    ? candidate.status
    : 'Đang vận hành';

  const dates = typeof candidate.dates === 'string' ? candidate.dates.slice(0, 100) : '';
  const origin = typeof candidate.origin === 'string' ? candidate.origin.slice(0, 10) : '';
  const originFull = typeof candidate.originFull === 'string' ? candidate.originFull.slice(0, 150) : '';
  const destination = typeof candidate.destination === 'string' ? candidate.destination.slice(0, 10) : '';
  const destinationFull = typeof candidate.destinationFull === 'string' ? candidate.destinationFull.slice(0, 150) : '';
  const destinationsCount = typeof candidate.destinationsCount === 'number' ? candidate.destinationsCount : 0;
  const totalKm = typeof candidate.totalKm === 'number' ? candidate.totalKm : 0;
  const vehicle = typeof candidate.vehicle === 'string' ? candidate.vehicle.slice(0, 100) : 'Xe du lịch';

  const members: TripMember[] = Array.isArray(candidate.members)
    ? (candidate.members as TripMember[]).slice(0, 100)
    : [];

  const membersTotal = typeof candidate.membersTotal === 'number' ? candidate.membersTotal : members.length;
  const membersOnline = typeof candidate.membersOnline === 'number' ? candidate.membersOnline : 0;
  const membersStatus = typeof candidate.membersStatus === 'string' ? candidate.membersStatus.slice(0, 100) : 'Chưa điểm danh';

  // Bảo toàn toàn bộ các trường thời tiết được LiveRouteMap sử dụng (humidity, windSpeed, isLive, lastFetched)
  const rawWeather = candidate.weather && typeof candidate.weather === 'object'
    ? (candidate.weather as Record<string, unknown>)
    : null;

  const weather: TripData['weather'] = rawWeather
    ? {
        temp: typeof rawWeather.temp === 'number' && Number.isFinite(rawWeather.temp) ? rawWeather.temp : 0,
        description: typeof rawWeather.description === 'string' ? rawWeather.description.slice(0, 100) : '',
        rainProb: typeof rawWeather.rainProb === 'string' ? rawWeather.rainProb.slice(0, 20) : '',
        rainProbTime: typeof rawWeather.rainProbTime === 'string' ? rawWeather.rainProbTime.slice(0, 20) : '',
        ...(typeof rawWeather.humidity === 'number' && Number.isFinite(rawWeather.humidity) ? { humidity: rawWeather.humidity } : {}),
        ...(typeof rawWeather.windSpeed === 'string' ? { windSpeed: rawWeather.windSpeed.slice(0, 30) } : {}),
        ...(typeof rawWeather.isLive === 'boolean' ? { isLive: rawWeather.isLive } : {}),
        ...(typeof rawWeather.lastFetched === 'string' ? { lastFetched: rawWeather.lastFetched.slice(0, 50) } : {}),
      }
    : {
        temp: 0,
        description: '',
        rainProb: '',
        rainProbTime: '',
      };

  // Bảo toàn các trường viễn thông / phương tiện (licensePlate, driverMemberId)
  const rawTelematics = candidate.telematics && typeof candidate.telematics === 'object'
    ? (candidate.telematics as Record<string, unknown>)
    : null;

  const gpsSource = rawTelematics?.gpsSource === 'gps' || rawTelematics?.gpsSource === 'manual' || rawTelematics?.gpsSource === 'route'
    ? rawTelematics.gpsSource
    : undefined;

  const telematics: TripData['telematics'] = rawTelematics
    ? {
        from: typeof rawTelematics.from === 'string' ? rawTelematics.from.slice(0, 150) : originFull,
        to: typeof rawTelematics.to === 'string' ? rawTelematics.to.slice(0, 150) : destinationFull,
        vehicleType: typeof rawTelematics.vehicleType === 'string' ? rawTelematics.vehicleType.slice(0, 100) : vehicle,
        driver: typeof rawTelematics.driver === 'string' ? rawTelematics.driver.slice(0, 100) : 'Chưa phân công',
        driverPhone: typeof rawTelematics.driverPhone === 'string' ? rawTelematics.driverPhone.slice(0, 30) : '',
        passengerCount: typeof rawTelematics.passengerCount === 'number' && Number.isFinite(rawTelematics.passengerCount) ? rawTelematics.passengerCount : membersTotal,
        ...(typeof rawTelematics.vehicleId === 'string' && rawTelematics.vehicleId.trim() ? { vehicleId: rawTelematics.vehicleId.trim().slice(0, 64) } : {}),
        ...(typeof rawTelematics.licensePlate === 'string' ? { licensePlate: rawTelematics.licensePlate.slice(0, 20) } : {}),
        ...(typeof rawTelematics.driverMemberId === 'string' ? { driverMemberId: rawTelematics.driverMemberId.slice(0, 128) } : {}),
        ...(typeof rawTelematics.currentLat === 'number' && Number.isFinite(rawTelematics.currentLat) && rawTelematics.currentLat >= -90 && rawTelematics.currentLat <= 90
          ? { currentLat: rawTelematics.currentLat }
          : {}),
        ...(typeof rawTelematics.currentLng === 'number' && Number.isFinite(rawTelematics.currentLng) && rawTelematics.currentLng >= -180 && rawTelematics.currentLng <= 180
          ? { currentLng: rawTelematics.currentLng }
          : {}),
        ...(typeof rawTelematics.gpsUpdatedAt === 'string' && rawTelematics.gpsUpdatedAt.trim() ? { gpsUpdatedAt: rawTelematics.gpsUpdatedAt.trim().slice(0, 64) } : {}),
        ...(gpsSource ? { gpsSource } : {}),
        ...(typeof rawTelematics.speedKmh === 'number' && Number.isFinite(rawTelematics.speedKmh) && rawTelematics.speedKmh >= 0
          ? { speedKmh: Math.round(rawTelematics.speedKmh) }
          : {}),
      }
    : {
        from: originFull,
        to: destinationFull,
        vehicleType: vehicle,
        driver: 'Chưa phân công',
        driverPhone: '',
        passengerCount: membersTotal,
      };

  const waypoints: Waypoint[] = Array.isArray(candidate.waypoints)
    ? (candidate.waypoints as Waypoint[]).slice(0, 50)
    : [];

  const alerts: OperationalAlert[] = Array.isArray(candidate.alerts)
    ? (candidate.alerts as OperationalAlert[]).slice(0, 50)
    : [];

  const aiSuggestions: AISuggestion[] = Array.isArray(candidate.aiSuggestions)
    ? (candidate.aiSuggestions as AISuggestion[]).slice(0, 10)
    : [];

  const aiSavingsEstimate = typeof candidate.aiSavingsEstimate === 'string'
    ? candidate.aiSavingsEstimate.slice(0, 50)
    : '0 ₫';

  const aiConfidence = typeof candidate.aiConfidence === 'string'
    ? candidate.aiConfidence.slice(0, 20)
    : '';

  const version = typeof candidate.version === 'number' && Number.isInteger(candidate.version) && candidate.version > 0
    ? candidate.version
    : undefined;

  // Strict property set: NO unknown prototype or random fields can pollute Firestore
  const normalized: TripData = {
    id,
    ...(typeof candidate.ownerId === 'string' ? { ownerId: candidate.ownerId } : {}),
    code,
    title,
    status,
    dates,
    origin,
    originFull,
    destination,
    destinationFull,
    destinationsCount,
    totalKm,
    vehicle,
    currentDay: safeCurrentDay,
    totalDays,
    totalActivities: totalActs,
    confirmedActivities: confirmedActs,
    pendingActivities: pendingActs,
    budgetTotal,
    budgetUsed,
    budgetRemaining,
    budgetUsedPercent,
    membersOnline,
    membersTotal,
    membersStatus,
    weather,
    telematics,
    waypoints,
    alerts,
    aiSuggestions,
    aiSavingsEstimate,
    aiConfidence,
    members,
    days,
    ...(typeof version === 'number' ? { version } : {}),
  };

  if (Array.isArray(candidate.invoices)) {
    const validCategories = new Set(['transport', 'hotel', 'meal', 'sightseeing', 'contingency']);
    normalized.invoices = candidate.invoices.slice(0, 100).map((rawInv, idx) => {
      const inv = (rawInv && typeof rawInv === 'object' ? rawInv : {}) as Record<string, unknown>;
      const cat = typeof inv.category === 'string' && validCategories.has(inv.category)
        ? (inv.category as ExpenseInvoice['category'])
        : 'contingency';
      const item: ExpenseInvoice = {
        id: typeof inv.id === 'string' && inv.id.trim() ? inv.id.trim().slice(0, 128) : `inv-${idx + 1}`,
        title: typeof inv.title === 'string' && inv.title.trim() ? inv.title.trim().slice(0, 200) : 'Khoản chi',
        category: cat,
        amount: typeof inv.amount === 'number' && Number.isFinite(inv.amount) && inv.amount >= 0 ? inv.amount : 0,
        date: typeof inv.date === 'string' ? inv.date.slice(0, 40) : '',
      };
      if (typeof inv.vendor === 'string' && inv.vendor.trim()) item.vendor = inv.vendor.trim().slice(0, 150);
      if (typeof inv.invoiceNumber === 'string' && inv.invoiceNumber.trim()) item.invoiceNumber = inv.invoiceNumber.trim().slice(0, 80);
      if (typeof inv.dayIndex === 'number' && Number.isFinite(inv.dayIndex) && inv.dayIndex > 0) item.dayIndex = inv.dayIndex;
      if (typeof inv.note === 'string' && inv.note.trim()) item.note = inv.note.trim().slice(0, 300);
      if (typeof inv.receiptId === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(inv.receiptId.trim())) {
        item.receiptId = inv.receiptId.trim();
      }
      if (typeof inv.receiptImage === 'string' && inv.receiptImage.startsWith('data:image/') && inv.receiptImage.length <= 260_000) {
        item.receiptImage = inv.receiptImage;
      }
      if (typeof inv.updatedAt === 'string' && inv.updatedAt.trim()) item.updatedAt = inv.updatedAt.trim().slice(0, 64);
      return item;
    });
  }

  if (candidate.customCategoryAllocations && typeof candidate.customCategoryAllocations === 'object') {
    normalized.customCategoryAllocations = candidate.customCategoryAllocations as TripData['customCategoryAllocations'];
  }

  return normalized;
}
