import { apiGet, apiPost, apiPut, apiDelete, getAuthHeaders, API_BASE } from './client';
import type { Diary } from '../data/types';

export interface DiaryQuery {
  stage_parent?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function fetchDiaries(projectId: string, query: DiaryQuery = {}): Promise<Diary[]> {
  const params = new URLSearchParams();
  if (query.stage_parent) params.set('stage_parent', query.stage_parent);
  if (query.q) params.set('q', query.q);
  if (query.limit) params.set('limit', query.limit.toString());
  if (query.offset) params.set('offset', query.offset.toString());
  const qs = params.toString();
  return apiGet<Diary[]>(`/api/projects/${projectId}/diaries${qs ? `?${qs}` : ''}`);
}

export async function fetchDiariesCount(projectId: string): Promise<{ count: number }> {
  return apiGet<{ count: number }>(`/api/projects/${projectId}/diaries/count`);
}

export interface DiaryInput {
  title: string;
  date: string;
  stage_parent: string;
  content: string;
  images: string[];
}

export async function createDiary(projectId: string, data: DiaryInput): Promise<Diary> {
  return apiPost<Diary>(`/api/projects/${projectId}/diaries`, data);
}

export async function updateDiary(projectId: string, diaryId: string, data: Partial<DiaryInput>): Promise<Diary> {
  return apiPut<Diary>(`/api/projects/${projectId}/diaries/${diaryId}`, data);
}

export async function deleteDiary(projectId: string, diaryId: string): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/diaries/${diaryId}`);
}

export async function uploadDiaryImage(file: File): Promise<{ url: string; filename: string }> {
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

export async function cleanupUnusedImages(): Promise<{ deleted_count: number; message: string }> {
  const headers: Record<string, string> = {};
  const token = getAuthHeaders()['Authorization'];
  if (token) {
    headers['Authorization'] = token;
  }

  const res = await fetch(`${API_BASE}/api/cleanup-unused-images`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
