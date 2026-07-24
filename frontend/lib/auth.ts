export type UserRole = 'manager' | 'sales' | 'editor' | 'admin' | 'shoot';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  username: string;
  role: UserRole;
  redirectTo: string;
  phone?: string;
  designation?: string;
}

export interface AuthContextValue {
  user: User | null;
  users: User[];
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  initAuth: () => void;
  updateProfile: (data: { email: string; username: string; password?: string }) => Promise<boolean>;
}

export const SESSION_KEY = 'howgarts_session';
