import { initialTripData } from './mockData';
import { Activity, TripData } from '../types/travel';

function isActivity(value: unknown): value is Activity {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Activity).id === 'string' &&
      typeof (value as Activity).timeStart === 'string' &&
      typeof (value as Activity).timeEnd === 'string' &&
      typeof (value as Activity).title === 'string' &&
      typeof (value as Activity).location === 'string',
  );
}

export function normalizeTripData(value: unknown): TripData {
  if (!value || typeof value !== 'object') return structuredClone(initialTripData);

  const candidate = value as Partial<TripData>;
  const days = Array.isArray(candidate.days)
    ? candidate.days.map((day) => {
        const activities = Array.isArray(day?.activities)
          ? day.activities.filter(isActivity)
          : [];

        return {
          ...day,
          activities,
          confirmedCount: Number.isFinite(day?.confirmedCount)
            ? day.confirmedCount
            : activities.filter((activity) => activity.status === 'Hoàn tất' || activity.status === 'Đã xác nhận').length,
          pendingCount: Number.isFinite(day?.pendingCount)
            ? day.pendingCount
            : activities.filter((activity) => activity.status === 'Cần xử lý' || activity.status === 'Đang diễn ra').length,
        };
      })
    : [];

  const allActivities = days.flatMap((day) => day.activities);
  const trip = {
    ...initialTripData,
    ...candidate,
    days,
    totalActivities: allActivities.length,
    confirmedActivities: allActivities.filter(
      (activity) => activity.status === 'Hoàn tất' || activity.status === 'Đã xác nhận',
    ).length,
    pendingActivities: allActivities.filter(
      (activity) => activity.status === 'Cần xử lý' || activity.status === 'Đang diễn ra',
    ).length,
  } as TripData;

  return trip;
}
