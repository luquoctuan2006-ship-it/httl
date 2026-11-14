import type { DaySchedule, TripData } from '../../../types/travel';
import { detectScheduleAndWeatherAlerts } from '../../../utils/alertDetector';
import { buildDynamicWaypoints } from '../../../utils/vietnamGeo';
import { buildMembers, formatDateDisplay } from './helpers';

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
}: BuildManualTripInput): TripData {
  const cleanTitle = tripTitle.trim();
  const cleanOrigin = origin.trim() || 'Điểm khởi hành';
  const cleanDestination = destination.trim() || 'Điểm đến';
  const stamp = Date.now();
  const budgetNum =
    typeof budgetEstimated === 'number' && budgetEstimated > 0
      ? budgetEstimated
      : Math.max(totalCalculatedCost * 1.2, 10000000);
  const allActivityLocations = manualDays
    .flatMap((day) => day.activities.map((activity) => activity.location))
    .filter(Boolean);
  const dynamicWaypoints = buildDynamicWaypoints(cleanOrigin, cleanDestination, allActivityLocations);

  const trip: TripData = {
    id: `trip-manual-${stamp}`,
    code: tripCode.trim().toUpperCase() || `VN-${Math.floor(100 + Math.random() * 900)}`,
    title: cleanTitle,
    status: 'Chuẩn bị',
    dates: `${formatDateDisplay(startDate)} (${totalDays} ngày)`,
    origin: cleanOrigin.slice(0, 3).toUpperCase(),
    originFull: cleanOrigin,
    destination: cleanDestination.slice(0, 3).toUpperCase(),
    destinationFull: cleanDestination,
    destinationsCount: dynamicWaypoints.length || totalDays,
    totalKm: totalDays * 75,
    vehicle,
    currentDay: 1,
    totalDays,
    totalActivities: totalActivitiesCount,
    confirmedActivities: totalActivitiesCount,
    pendingActivities: 0,
    budgetTotal: Math.round(budgetNum),
    budgetUsed: totalCalculatedCost,
    budgetRemaining: Math.max(0, Math.round(budgetNum - totalCalculatedCost)),
    budgetUsedPercent: budgetNum > 0 ? Math.min(100, Math.round((totalCalculatedCost / budgetNum) * 100)) : 0,
    membersOnline: 0,
    membersTotal: membersCount,
    membersStatus: `0/${membersCount} đã điểm danh`,
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
      passengerCount: membersCount,
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
    members: buildMembers(membersCount),
    days: manualDays,
  };

  const detectedAlerts = detectScheduleAndWeatherAlerts(trip);
  if (detectedAlerts.length > 0) {
    trip.alerts = detectedAlerts;
  }

  return trip;
}
