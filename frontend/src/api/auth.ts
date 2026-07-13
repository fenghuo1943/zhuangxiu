import { apiPost, apiGet, setToken, getToken } from './client';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

function generateDeviceId(): string {
  // 生成一个持久的设备标识，存储在 localStorage
  const key = 'xiaozhuangjia_device_id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    // 使用 crypto.randomUUID 生成唯一 ID
    deviceId = crypto.randomUUID?.() || `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/** 确保有一个有效的设备令牌。如果已登录则跳过（登录用户有独立身份）。
 *  未登录时调用后端注册/查找设备游客，获取 JWT 并存储。
 *  每个设备的 localStorage 中存储唯一的 device_id，保证数据隔离。 */
export async function ensureDeviceToken(): Promise<void> {
  // 已登录用户有自己的身份，不需要设备令牌
  if (getToken()) return;

  const deviceId = generateDeviceId();
  try {
    const res = await apiPost<AuthResponse>('/api/auth/guest', { device_id: deviceId });
    setToken(res.token);
  } catch {
    // 后端不可达 — 保持离线模式（localStorage 兜底）
  }
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
