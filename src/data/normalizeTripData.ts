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
  const dayNamesCycle = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const days = Array.isArray(candidate.days)
    ? candidate.days.map((day, idx) => {
        const activities = Array.isArray(day?.activities)
          ? day.activities.filter(isActivity)
          : [];

        const dayIndex = typeof day?.dayIndex === 'number' && day.dayIndex > 0 ? day.dayIndex : idx + 1;
        const fallbackDayName = dayNamesCycle[(dayIndex - 1) % 7];
        const dayName = (day?.dayName && typeof day.dayName === 'string' && day.dayName.trim()) ? day.dayName : fallbackDayName;
        const dateNum = typeof day?.dateNum === 'number' ? day.dateNum : dayIndex;
        const fullDate = (day?.fullDate && typeof day.fullDate === 'string' && day.fullDate.trim()) ? day.fullDate : `Ngày ${dayIndex}`;
        const dateLabel = (day?.dateLabel && typeof day.dateLabel === 'string' && day.dateLabel.trim()) ? day.dateLabel : `${dayName} ${dateNum}`;

        return {
          ...day,
          dayIndex,
          dayName,
          dateNum,
          fullDate,
          dateLabel,
          dispatcherNote: typeof day?.dispatcherNote === 'string' ? day.dispatcherNote : '',
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
  const safeCurrentDay =
    typeof candidate.currentDay === 'number' && days.some((d) => d.dayIndex === candidate.currentDay)
      ? candidate.currentDay
      : (days[0]?.dayIndex ?? 1);

  const trip = {
    ...initialTripData,
    ...candidate,
    days,
    currentDay: safeCurrentDay,
    totalDays: typeof candidate.totalDays === 'number' && candidate.totalDays > 0 ? candidate.totalDays : Math.max(days.length, 1),
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
