import { cookies } from 'next/headers';
import type { BackendUser } from './backend-users';

export function getAuthenticatedUser(): BackendUser | null {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('howgarts_session');
    if (!sessionCookie?.value) return null;

    const parsed = JSON.parse(sessionCookie.value);
    if (!parsed || !parsed.email) return null;

    // Return user details directly from cookie (already sanitized)
    return parsed as BackendUser;
  } catch (error) {
    console.error('Error getting server authenticated user:', error);
    return null;
  }
}
