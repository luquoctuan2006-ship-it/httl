import type { DaySchedule, TripData } from '../../../types/travel';
import { detectScheduleAndWeatherAlerts } from '../../../utils/alertDetector';
import { computeTripBudgetSummaryFields } from '../../../utils/budgetAlerts';
import { countPassengerMembers } from '../../../utils/tripJoinHelpers';
import { buildDynamicWaypoints } from '../../../utils/vietnamGeo';
import {
  buildDayCalendarMetadata,
  buildMembers,
  buildTripDatesLabel,
  computeEstimatedRouteKm,
  normalizeActivityType,
  resolveActivityCoordinatesWithFallback,
  type TripCreatorOwner,
} from './helpers';

interface BuildManualTripInput {
  tripTitle: string;
  tripCode: string;
  origin: string;
  destination: string;
  startDate: string;
  totalDays: number;
  vehicle: string;
  membersCount: number;
  budgetEstimated: number | '';
  totalCalculatedCost: number;
  totalActivitiesCount: number;
  manualDays: DaySchedule[];
  owner?: TripCreatorOwner;
}

export function buildManualTrip({
  tripTitle,
  tripCode,
  origin,
  destination,
  startDate,
  totalDays,
  vehicle,
  membersCount,
  budgetEstimated,
  totalCalculatedCost,
  totalActivitiesCount,
  manualDays,
  owner,
}: BuildManualTripInput): TripData {
  const cleanTitle = tripTitle.trim();
  const cleanOrigin = origin.trim() || 'Điểm khởi hành';
  const cleanDestination = destination.trim() || 'Điểm đến';
  const stamp = Date.now();
  const budgetNum =
    typeof budgetEstimated === 'number' && budgetEstimated > 0
      ? budgetEstimated
      : Math.max(totalCalculatedCost * 1.2, 10000000);

  const enrichedDays: DaySchedule[] = manualDays.map((day, idx) => {
    const dayIndex = idx + 1;
    const activities = (day.activities || [])
      .map((act, actIdx) => {
        const cleanLoc = act.location?.trim() || cleanDestination;
        const coords = resolveActivityCoordinatesWithFallback(cleanLoc, act.title, act.coordinates);
        return {
          ...act,
          id: act.id?.trim() || `act-manual-${stamp}-${dayIndex}-${actIdx + 1}`,
          location: cleanLoc,
          type: normalizeActivityType(act.type),
          cost: typeof act.cost === 'number' && Number.isFinite(act.cost) && act.cost >= 0 ? Math.round(act.cost) : 0,
          ...(coords ? { coordinates: coords } : {}),
        };
      })
      .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));

    const calendarMeta = buildDayCalendarMetadata(startDate, dayIndex, day.fullDate);
    return {
      ...day,
      dayIndex,
      ...calendarMeta,
      activities,
      confirmedCount: activities.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length,
      pendingCount: activities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra' || a.status === 'Chờ duyệt').length,
    };
  });

  const allActivityLocations = enrichedDays
    .flatMap((day) => day.activities.map((activity) => activity.location))
    .filter(Boolean);
  const dynamicWaypoints = buildDynamicWaypoints(cleanOrigin, cleanDestination, allActivityLocations);
  const estimatedKm = computeEstimatedRouteKm(dynamicWaypoints, totalDays * 75);
  const members = buildMembers(membersCount, owner);
  const membersOnline = members.filter((m) => m.status === 'online').length;
  const resolvedActivitiesCount = enrichedDays.reduce((sum, d) => sum + d.activities.length, 0) || totalActivitiesCount;
  const resolvedConfirmedCount = enrichedDays.reduce((sum, d) => sum + d.confirmedCount, 0);
  const resolvedPendingCount = enrichedDays.reduce((sum, d) => sum + d.pendingCount, 0);

  const trip: TripData = {
    id: `trip-manual-${stamp}`,
    code: tripCode.trim().toUpperCase() || `VN-${Math.floor(100 + Math.random() * 900)}`,
    title: cleanTitle,
    status: 'Chuẩn bị',
    dates: buildTripDatesLabel(startDate, enrichedDays.length || totalDays),
    origin: cleanOrigin.slice(0, 3).toUpperCase(),
    originFull: cleanOrigin,
    destination: cleanDestination.slice(0, 3).toUpperCase(),
    destinationFull: cleanDestination,
    destinationsCount: dynamicWaypoints.length || totalDays,
    totalKm: estimatedKm,
    vehicle,
    currentDay: 1,
    totalDays: enrichedDays.length || totalDays,
    totalActivities: resolvedActivitiesCount,
    confirmedActivities: resolvedConfirmedCount,
    pendingActivities: resolvedPendingCount,
    budgetTotal: Math.round(budgetNum),
    budgetUsed: 0,
    budgetRemaining: Math.round(budgetNum),
    budgetUsedPercent: 0,
    membersOnline,
    membersTotal: members.length,
    membersStatus: `0/${members.length} đã điểm danh`,
    weather: {
      temp: 0,
      description: '',
      rainProb: '',
      rainProbTime: '',
    },
    telematics: {
      from: cleanOrigin,
      to: cleanDestination,
      vehicleType: vehicle,
      driver: 'Chưa phân công',
      driverPhone: '',
      passengerCount: countPassengerMembers(members),
    },
    waypoints: dynamicWaypoints,
    alerts: [],
    aiSuggestions: [
      {
        id: `sug-manual-${stamp}`,
        title: 'Lịch trình được khởi tạo thủ công',
        badge: 'Tự lập lịch',
        description: 'Các mốc thời gian và hoạt động được người dùng thiết lập hoàn toàn tự do theo nhu cầu.',
      },
    ],
    aiSavingsEstimate: '',
    aiConfidence: '',
    members,
    days: enrichedDays,
  };

  Object.assign(trip, computeTripBudgetSummaryFields(trip));

  const detectedAlerts = detectScheduleAndWeatherAlerts(trip);
  if (detectedAlerts.length > 0) {
    trip.alerts = detectedAlerts;
  }

  return trip;
}
