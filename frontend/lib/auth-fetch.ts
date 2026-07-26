/**
 * Authenticated fetch wrapper for client-side API calls.
 * Automatically attaches:
 *   X-Auth-Token  → JWT from localStorage (for backend authorization)
 *   X-Auth-User   → User session JSON from localStorage (for server-side identity check)
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

/**
 * Drop-in replacement for fetch() that automatically includes the auth headers.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const session = getStoredSession();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { 'X-Auth-Token': token } : {}),
      ...(session ? { 'X-Auth-User': session } : {}),
    },
  });
}
