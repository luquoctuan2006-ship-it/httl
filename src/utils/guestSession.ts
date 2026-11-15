import type { GuestTripData } from '../types/travel';
import { isValidJoinCodeFormat, normalizeJoinCode } from './tripJoinHelpers';

export interface ActiveGuestSession {
  joinCode: string;
  guestName: string;
  trip: GuestTripData;
  enteredFromAccount?: boolean;
}

const GUEST_SESSION_STORAGE_KEY = 'voyager_guest_session_v1';

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

export function loadStoredGuestSession(): { joinCode: string; guestName: string } | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { joinCode?: unknown; guestName?: unknown };
    const joinCode = normalizeJoinCode(parsed.joinCode);
    if (!isValidJoinCodeFormat(joinCode)) return null;
    const guestName =
      typeof parsed.guestName === 'string' && parsed.guestName.trim()
        ? parsed.guestName.trim().slice(0, 80)
        : 'Hành khách';
    return { joinCode, guestName };
  } catch {
    return null;
  }
}

export function saveStoredGuestSession(joinCode: string, guestName: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const cleanCode = normalizeJoinCode(joinCode);
    if (!isValidJoinCodeFormat(cleanCode)) return;
    window.sessionStorage.setItem(
      GUEST_SESSION_STORAGE_KEY,
      JSON.stringify({ joinCode: cleanCode, guestName: guestName.trim() || 'Hành khách' }),
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearStoredGuestSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
