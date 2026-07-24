import type { UserRole } from './auth';

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  role: UserRole;
  initials: string;
  username: string;
  redirectTo: string;
  password?: string;
}

export const BACKEND_USERS: BackendUser[] = [];

export function updateBackendUser(id: string, data: { email?: string; username?: string; password?: string }) {
  const user = BACKEND_USERS.find((u) => u.id === id);
  if (!user) return false;
  if (data.email) user.email = data.email.trim();
  if (data.username) user.username = data.username.trim().toLowerCase();
  if (data.password) user.password = data.password.trim();
  return true;
}
