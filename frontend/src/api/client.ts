const API_BASE = 'http://localhost:8003';
const REQUEST_TIMEOUT_MS = 10000; // 10s timeout

let _token: string | null = localStorage.getItem('xiaozhuangjia_token');

export function getToken(): string | null {
  return _token;
}

export function setToken(token: string | null) {
  _token = token;
  if (token) {
    localStorage.setItem('xiaozhuangjia_token', token);
  } else {
    localStorage.removeItem('xiaozhuangjia_token');
  }
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

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
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
