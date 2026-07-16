import { apiPost, apiGet, setToken } from './client';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/api/auth/register', { username, email, password });
  setToken(res.token);
  return res;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/api/auth/login', { username, password });
  setToken(res.token);
  return res;
}

export async function getMe(): Promise<UserInfo> {
  return apiGet<UserInfo>('/api/auth/me');
}

export function logout() {
  setToken(null);
}
