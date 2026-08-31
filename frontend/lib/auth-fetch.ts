/**
 * Authenticated fetch wrapper for client-side API calls.
 * Automatically attaches:
 *   X-Auth-Token  → JWT from localStorage (for backend authorization)
 *   X-Auth-User   → User session JSON from localStorage (for server-side identity check)
 *
 * Auto-refresh: if a 401 is received, silently calls /api/auth/refresh-token,
 * updates the stored token, then retries the original request once.
 * If refresh also fails, clears the session and redirects to /login.
 */

import { TOKEN_KEY, SESSION_KEY } from './auth';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_KEY);
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh-token', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.token) {
      // Update the token stored in localStorage so future requests use it
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, data.token);
      }
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  // Only redirect if not already on the login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

/**
 * Drop-in replacement for fetch() that automatically includes the auth headers
 * and handles transparent token refresh on 401 responses.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const makeRequest = (token: string | null) => {
    const session = getStoredSession();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { 'X-Auth-Token': token } : {}),
        ...(session ? { 'X-Auth-User': session } : {}),
      },
    });
  };

  const token = getStoredToken();
  const response = await makeRequest(token);

  // If we got a 401, try to silently refresh the token and retry once
  if (response.status === 401) {
    if (isRefreshing) {
      // Another request is already refreshing — queue this one and wait
      return new Promise<Response>((resolve) => {
        subscribeTokenRefresh(async (newToken) => {
          if (newToken) {
            resolve(await makeRequest(newToken));
          } else {
            // Refresh failed; return the original 401 so caller can handle it
            resolve(response);
          }
        });
      });
    }

    isRefreshing = true;
    const newToken = await tryRefreshToken();
    isRefreshing = false;
    onTokenRefreshed(newToken);

    if (newToken) {
      // Retry the original request with the fresh token
      return makeRequest(newToken);
    } else {
      // Refresh failed — session is truly expired; kick the user to login
      clearSessionAndRedirect();
      return response;
    }
  }

  return response;
}
