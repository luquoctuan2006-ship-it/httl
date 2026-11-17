import type { GuestTripData } from '../types/travel';
import { isValidJoinCodeFormat, normalizeJoinCode } from './tripJoinHelpers';

export interface ActiveGuestSession {
  joinCode: string;
  guestName: string;
  trip: GuestTripData;
  enteredFromAccount?: boolean;
  cachedAt?: string;
}

const GUEST_SESSION_STORAGE_KEY = 'voyager_guest_session_v1';

export interface StoredGuestSession {
  joinCode: string;
  guestName: string;
  trip?: GuestTripData;
  cachedAt?: string;
}

export function extractGuestCodeFromUrl(): string {
  if (typeof window === 'undefined' || !window.location) return '';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('guestCode') || params.get('code') || '';
  const normalized = normalizeJoinCode(raw);
  return isValidJoinCodeFormat(normalized) ? normalized : '';
}

export function clearGuestCodeFromUrl(): void {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('guestCode') || url.searchParams.has('code')) {
    url.searchParams.delete('guestCode');
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

export function loadStoredGuestSession(): StoredGuestSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.localStorage?.getItem(GUEST_SESSION_STORAGE_KEY) ||
      window.sessionStorage?.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      joinCode?: unknown;
      guestName?: unknown;
      trip?: unknown;
      cachedAt?: unknown;
    };
    const joinCode = normalizeJoinCode(parsed.joinCode);
    if (!isValidJoinCodeFormat(joinCode)) return null;
    const guestName =
      typeof parsed.guestName === 'string' && parsed.guestName.trim()
        ? parsed.guestName.trim().slice(0, 80)
        : 'Hành khách';
    const trip =
      parsed.trip &&
      typeof parsed.trip === 'object' &&
      typeof (parsed.trip as GuestTripData).id === 'string' &&
      Array.isArray((parsed.trip as GuestTripData).days)
        ? (parsed.trip as GuestTripData)
        : undefined;
    const cachedAt = typeof parsed.cachedAt === 'string' ? parsed.cachedAt : undefined;
    return { joinCode, guestName, ...(trip ? { trip } : {}), ...(cachedAt ? { cachedAt } : {}) };
  } catch {
    return null;
  }
}

export function saveStoredGuestSession(
  joinCode: string,
  guestName: string,
  trip?: GuestTripData,
): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanCode = normalizeJoinCode(joinCode);
    if (!isValidJoinCodeFormat(cleanCode)) return;
    const payload: StoredGuestSession = {
      joinCode: cleanCode,
      guestName: guestName.trim() || 'Hành khách',
      ...(trip ? { trip, cachedAt: new Date().toISOString() } : {}),
    };
    const serialized = JSON.stringify(payload);
    window.localStorage?.setItem(GUEST_SESSION_STORAGE_KEY, serialized);
    window.sessionStorage?.setItem(GUEST_SESSION_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearStoredGuestSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(GUEST_SESSION_STORAGE_KEY);
    window.sessionStorage?.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
