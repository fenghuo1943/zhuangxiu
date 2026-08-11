export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8003';
const REQUEST_TIMEOUT_MS = 10000; // 10s timeout
const ACCESS_TOKEN_KEY = 'xiaozhuangjia_token';
const REFRESH_TOKEN_KEY = 'xiaozhuangjia_refresh_token';
// 主动轮换节流：距上次轮换不足该间隔则不重复调用刷新接口（避免频繁切标签页刷接口）
const ROTATE_THROTTLE_MS = 30 * 60 * 1000; // 30 分钟

let _token: string | null = localStorage.getItem(ACCESS_TOKEN_KEY);
let _refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);
// 并发 401 时共享同一次刷新请求（防刷新风暴）
let refreshPromise: Promise<string | null> | null = null;
let _lastRotateAt = 0;

export function getToken(): string | null {
  return _token;
}

export function getRefreshToken(): string | null {
  return _refreshToken;
}

/** 同时写入访问令牌与刷新令牌。 */
export function storeTokens(accessToken: string, refreshToken: string) {
  _token = accessToken;
  _refreshToken = refreshToken;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** 清除两个令牌（登出 / 长期令牌失效）。 */
export function clearTokens() {
  _token = null;
  _refreshToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }
  return headers;
}

function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, clear: () => clearTimeout(timer) };
}

/** 本地解码访问令牌的过期时间（毫秒时间戳）；解析失败返回 null。 */
export function getAccessTokenExpiry(): number | null {
  if (!_token) return null;
  try {
    const payload = JSON.parse(atob(_token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** 主动轮换一对新令牌（每次访问 / 定时调用）。成功返回 true。 */
export async function rotateTokens(): Promise<boolean> {
  if (!_refreshToken) return false;
  const newToken = await ensureFreshAccess();
  if (newToken) {
    _lastRotateAt = Date.now();
    return true;
  }
  return false;
}

/** 节流后的主动轮换：距上次轮换超过节流间隔才真正调用刷新接口。 */
export function maybeRotate(): void {
  if (!_refreshToken || !_token) return;
  if (Date.now() - _lastRotateAt < ROTATE_THROTTLE_MS) return;
  rotateTokens().catch(() => {});
}

/**
 * 用长期刷新令牌换发新访问令牌。
 * 并发调用共享同一次刷新；刷新失败（长期令牌失效）返回 null 并清除令牌。
 */
function ensureFreshAccess(): Promise<string | null> {
  if (!_refreshToken) return Promise.resolve(null);
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** 调用刷新接口（直接 fetch，不经过 request()，避免递归触发 401 重试）。 */
async function doRefresh(): Promise<string | null> {
  const { signal, clear } = createTimeoutSignal(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: _refreshToken }),
      signal,
    });
    clear();
  } catch {
    clear();
    // 网络错误：保留令牌，本次刷新失败，由调用方决定
    return null;
  }
  if (!res.ok) {
    // 服务端明确拒绝（长期令牌失效/无效）→ 登出
    clearTokens();
    return null;
  }
  try {
    const data = await res.json();
    storeTokens(data.token, data.refresh_token);
    return data.token;
  } catch {
    return null;
  }
}

async function request<T = any>(method: string, path: string, body?: any, skipRefreshRetry = false): Promise<T> {
  const headers = getAuthHeaders();
  const { signal, clear } = createTimeoutSignal(REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    clear();

    // 访问令牌失效（401）→ 自动用长期令牌刷新一次后重试
    if (res.status === 401 && !skipRefreshRetry) {
      const newToken = await ensureFreshAccess();
      if (newToken) {
        return request<T>(method, path, body, true);
      }
      throw new Error('登录已过期，请重新登录');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    // 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (e: any) {
    clear();
    if (e.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务是否已启动');
    }
    throw e;
  }
}

export async function apiGet<T = any>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  return request<T>('POST', path, body);
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  return request<T>('PUT', path, body);
}

export async function apiDelete(path: string): Promise<void> {
  return request<void>('DELETE', path);
}

export function isAuthenticated(): boolean {
  return !!_token;
}
