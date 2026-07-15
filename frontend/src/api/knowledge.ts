import { apiGet, apiPost, apiPut, apiDelete, getAuthHeaders } from './client';
import type { KnowledgeArticle } from '../data/types';

const API_BASE = 'http://localhost:8003';

export async function fetchArticle(resourceId: number): Promise<KnowledgeArticle> {
  return apiGet<KnowledgeArticle>(`/api/knowledge/${resourceId}`);
}

export async function createArticle(
  resourceId: number,
  data: { resource_id: number; title: string; content: string },
): Promise<KnowledgeArticle> {
  return apiPost<KnowledgeArticle>(`/api/knowledge/${resourceId}`, data);
}

export async function updateArticle(
  resourceId: number,
  data: { title?: string; content?: string },
): Promise<KnowledgeArticle> {
  return apiPut<KnowledgeArticle>(`/api/knowledge/${resourceId}`, data);
}

export async function deleteArticle(resourceId: number): Promise<void> {
  return apiDelete(`/api/knowledge/${resourceId}`);
}

export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
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
