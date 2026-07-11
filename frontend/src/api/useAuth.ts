import { useState, useEffect, useCallback } from 'react';
import { getToken, setToken, isAuthenticated } from './client';
import { getMe, logout as apiLogout, login as apiLogin, register as apiRegister } from './auth';
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
    // Auto-check auth on mount
    if (globalAuthState.loading && isAuthenticated()) {
      getMe()
        .then(user => {
          globalAuthState = { user, loading: false, error: null, isLoggedIn: true };
          notify();
        })
        .catch(() => {
          setToken(null);
          globalAuthState = { user: null, loading: false, error: null, isLoggedIn: false };
          notify();
        });
    }
    return () => { listeners.splice(listeners.indexOf(cb), 1); };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    globalAuthState = { ...globalAuthState, loading: true, error: null };
    notify();
    try {
      const res = await apiLogin(username, password);
      globalAuthState = { user: res.user, loading: false, error: null, isLoggedIn: true };
    } catch (e: any) {
      globalAuthState = { ...globalAuthState, loading: false, error: e.message };
    }
    notify();
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    globalAuthState = { ...globalAuthState, loading: true, error: null };
    notify();
    try {
      const res = await apiRegister(username, email, password);
      globalAuthState = { user: res.user, loading: false, error: null, isLoggedIn: true };
    } catch (e: any) {
      globalAuthState = { ...globalAuthState, loading: false, error: e.message };
    }
    notify();
  }, []);

  const logout = useCallback(() => {
    apiLogout();
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
