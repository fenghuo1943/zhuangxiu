import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, getRefreshToken, rotateTokens, maybeRotate, clearTokens } from './client';
import { getMe, logout as apiLogout, login as apiLogin, register as apiRegister } from './auth';
import { migrateLocalDataToServer, syncFromServerAfterLogin } from '../data/store';
import type { UserInfo } from './auth';

interface AuthState {
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  isLoggedIn: boolean;
}

let globalAuthState: AuthState = {
  user: null,
  loading: true,
  error: null,
  isLoggedIn: false,
};

const listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(l => l());
}

// 单例初始化 Promise，防止多个组件 mount 导致重复的初始化请求（尤其在 React.StrictMode 下）
let authInitPromise: Promise<void> | null = null;

export function useAuth(): AuthState & {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick(t => t + 1);
    listeners.push(cb);

    // Auto-check auth on mount — use single shared promise so multiple mounts
    // (e.g. caused by React.StrictMode in dev) don't trigger duplicated network calls.
    if (globalAuthState.loading) {
      if (!authInitPromise) {
        authInitPromise = (async () => {
          if (isAuthenticated()) {
            // 每次访问后台主动轮换一对新令牌（有刷新令牌时），不阻塞页面加载
            if (getRefreshToken()) {
              rotateTokens().catch(() => {});
            }
            try {
              const user = await getMe();
              globalAuthState = { user, loading: false, error: null, isLoggedIn: true };
              notify();
              // Pull server data after verifying token is valid
              // syncFromServerAfterLogin 可能包含多次 API 请求，保证只被触发一次
              await syncFromServerAfterLogin();
            } catch (e) {
              clearTokens();
              globalAuthState = { user: null, loading: false, error: null, isLoggedIn: false };
              notify();
            }
          } else {
            // No token stored — not logged in, use local data only
            globalAuthState = { user: null, loading: false, error: null, isLoggedIn: false };
            notify();
          }
        })().finally(() => {
          authInitPromise = null;
        });
      }
    }

    return () => { listeners.splice(listeners.indexOf(cb), 1); };
  }, []);

  // 访问网站（窗口焦点/回到页面）与间隔定时自动刷新长期和短期令牌
  useEffect(() => {
    if (!globalAuthState.isLoggedIn) return;
    const onFocus = () => maybeRotate();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRotate();
    };
    const timer = setInterval(() => maybeRotate(), 60 * 60 * 1000); // 每小时轮换
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [globalAuthState.isLoggedIn]);

  const login = useCallback(async (username: string, password: string) => {
    globalAuthState = { ...globalAuthState, loading: true, error: null };
    notify();
    try {
      const res = await apiLogin(username, password);
      globalAuthState = { user: res.user, loading: false, error: null, isLoggedIn: true };
      notify();
      // Migrate local data to server, then reload from server
      await migrateLocalDataToServer(res.user.id);
    } catch (e: any) {
      globalAuthState = { ...globalAuthState, loading: false, error: e.message };
      notify();
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    globalAuthState = { ...globalAuthState, loading: true, error: null };
    notify();
    try {
      const res = await apiRegister(username, email, password);
      globalAuthState = { user: res.user, loading: false, error: null, isLoggedIn: true };
      notify();
      // Migrate local data to server for new user
      await migrateLocalDataToServer(res.user.id);
    } catch (e: any) {
      globalAuthState = { ...globalAuthState, loading: false, error: e.message };
      notify();
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    // 清除本地应用状态缓存，确保下次登录从数据库重新加载
    localStorage.removeItem('xiaozhuangjia_state_v1');
    globalAuthState = { user: null, loading: false, error: null, isLoggedIn: false };
    notify();
  }, []);

  const clearError = useCallback(() => {
    globalAuthState = { ...globalAuthState, error: null };
    notify();
  }, []);

  return { ...globalAuthState, login, register, logout, clearError };
}

export function getAuthState(): AuthState {
  return globalAuthState;
}
