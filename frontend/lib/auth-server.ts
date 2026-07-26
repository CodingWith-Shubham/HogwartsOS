import { cookies } from 'next/headers';
import type { BackendUser } from './backend-users';

/**
 * Reads authenticated user from:
 * 1. howgarts_session cookie (set at login time)
 * 2. X-Auth-User request header (forwarded from localStorage by authFetch)
 */
export function getAuthenticatedUser(requestHeaders?: Headers): BackendUser | null {
  try {
    // 1. Try howgarts_session cookie first
    try {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get('howgarts_session');
      if (sessionCookie?.value) {
        const parsed = JSON.parse(sessionCookie.value);
        if (parsed?.email) return parsed as BackendUser;
      }
    } catch (_) {
      // cookies() may throw outside request context — ignore
    }

    // 2. Fallback: check X-Auth-User request header
    const headerUser = requestHeaders?.get('x-auth-user');
    if (headerUser) {
      const parsed = JSON.parse(headerUser);
      if (parsed?.email) return parsed as BackendUser;
    }

    return null;
  } catch (error) {
    console.error('Error getting server authenticated user:', error);
    return null;
  }
}

/**
 * Reads JWT token from:
 * 1. howgarts_token httpOnly cookie (set at login time)
 * 2. X-Auth-Token request header (forwarded from localStorage by authFetch)
 */
export function getAccessToken(requestHeaders?: Headers): string | null {
  try {
    // 1. Try httpOnly cookie first
    try {
      const cookieStore = cookies();
      const tokenCookie = cookieStore.get('howgarts_token');
      if (tokenCookie?.value) return tokenCookie.value;
    } catch (_) {
      // cookies() may throw outside request context — ignore
    }

    // 2. Fallback: check X-Auth-Token request header
    const headerToken = requestHeaders?.get('x-auth-token');
    if (headerToken) return headerToken;

    return null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}
