import { cookies } from 'next/headers';
import type { BackendUser } from './backend-users';

export function getAuthenticatedUser(): BackendUser | null {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('howgarts_session');
    if (!sessionCookie?.value) return null;

    const parsed = JSON.parse(sessionCookie.value);
    if (!parsed || !parsed.email) return null;

    return parsed as BackendUser;
  } catch (error) {
    console.error('Error getting server authenticated user:', error);
    return null;
  }
}

export function getAccessToken(): string | null {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('howgarts_token');
    return tokenCookie?.value ?? null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}
