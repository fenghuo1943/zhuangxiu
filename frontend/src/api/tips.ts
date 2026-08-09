import { apiGet, apiPost, apiPut, apiDelete, getAuthHeaders, API_BASE } from './client';
import type { Tip, TipStatus } from '../data/types';

export interface TipQuery {
  room?: string;
  status?: TipStatus;
  q?: string;
}

export async function fetchTips(query: TipQuery = {}): Promise<Tip[]> {
  const params = new URLSearchParams();
  if (query.room) params.set('room', query.room);
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  const qs = params.toString();
  return apiGet<Tip[]>(`/api/tips${qs ? `?${qs}` : ''}`);
}

export interface TipInput {
  title: string;
  room: string;
  content: string;
  status: TipStatus;
  images: string[];
}

export async function createTip(data: TipInput): Promise<Tip> {
  return apiPost<Tip>('/api/tips', data);
}

export async function updateTip(id: string, data: Partial<TipInput>): Promise<Tip> {
  return apiPut<Tip>(`/api/tips/${id}`, data);
}

export async function deleteTip(id: string): Promise<void> {
  return apiDelete(`/api/tips/${id}`);
}

export async function uploadTipImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  const token = getAuthHeaders()['Authorization'];
  if (token) {
    headers['Authorization'] = token;
  }

  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
