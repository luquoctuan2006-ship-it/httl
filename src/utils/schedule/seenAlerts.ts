import type { OperationalAlert } from '../../types/travel';

const SEEN_ALERTS_STORAGE_PREFIX = 'voyager_seen_alerts_';

export function getSeenAlertIds(tripId?: string): Set<string> {
  if (!tripId || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${SEEN_ALERTS_STORAGE_PREFIX}${tripId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

export function markAlertsAsSeen(tripId: string, alertIds: string[]): Set<string> {
  const existing = getSeenAlertIds(tripId);
  const next = new Set(existing);
  let changed = false;
  for (const id of alertIds) {
    if (id && !next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (changed && typeof window !== 'undefined') {
    try {
      const compact = Array.from(next).slice(-200);
      window.localStorage.setItem(`${SEEN_ALERTS_STORAGE_PREFIX}${tripId}`, JSON.stringify(compact));
      return new Set(compact);
    } catch {
      return next;
    }
  }
  return next;
}

export function countUnreadAlerts(alerts: OperationalAlert[], seenIds: Set<string>): number {
  return (alerts || []).filter((alert) => alert?.id && !seenIds.has(alert.id)).length;
}
