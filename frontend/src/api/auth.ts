import { apiPost, apiGet, storeTokens, clearTokens } from './client';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: UserInfo;
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/api/auth/register', { username, email, password });
  storeTokens(res.token, res.refresh_token);
  return res;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/api/auth/login', { username, password });
  storeTokens(res.token, res.refresh_token);
  return res;
}

export async function getMe(): Promise<UserInfo> {
  return apiGet<UserInfo>('/api/auth/me');
}

export function logout() {
  clearTokens();
}
