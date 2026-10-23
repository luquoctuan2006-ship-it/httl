import { firebaseAuth } from './firebase';

const SESSION_TOKEN_KEY = 'voyager_session_token';

let mockToken = typeof localStorage !== 'undefined'
  ? localStorage.getItem(SESSION_TOKEN_KEY) || 'mock-token:mock-admin:admin:admin@voyager.vn'
  : 'mock-token:mock-admin:admin:admin@voyager.vn';

export function setMockAuthToken(token: string) {
  mockToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }
}

export function clearMockAuthToken() {
  mockToken = '';
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = firebaseAuth?.currentUser;
  const headers = new Headers(init.headers);

  if (user) {
    try {
      const idToken = await user.getIdToken();
      headers.set('Authorization', `Bearer ${idToken}`);
    } catch (tokenErr) {
      console.warn('Could not retrieve Firebase ID token, using fallback token:', tokenErr);
      headers.set('Authorization', `Bearer ${mockToken}`);
    }
  } else {
    headers.set('Authorization', `Bearer ${mockToken}`);
  }

  return fetch(input, { ...init, headers });
}

export async function safeJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json') && text.trim().startsWith('<')) {
    throw new Error(
      `Máy chủ phản hồi HTML thay vì JSON (HTTP ${response.status}). Vui lòng kiểm tra API hoặc làm mới phiên làm việc.`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Dữ liệu máy chủ không đúng định dạng JSON: ${text.slice(0, 120)}...`
    );
  }
}