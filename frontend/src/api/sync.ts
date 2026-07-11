import { apiGet, apiPost } from './client';
import type { AppState } from '../data/types';

/** Push full local state to backend */
export async function pushState(projectId: string, state: AppState): Promise<void> {
  await apiPost(`/api/projects/${projectId}/sync/import`, state);
}

/** Pull full state from backend */
export async function pullState(projectId: string): Promise<Partial<AppState>> {
  return apiPost(`/api/projects/${projectId}/sync/export`);
}

/** Create a project on the backend */
export async function createProject(name: string): Promise<{ id: string }> {
  return apiPost('/api/projects', { name });
}

/** List user's projects from backend */
export async function listProjects(): Promise<Array<{ id: string; name: string }>> {
  return apiGet('/api/projects');
}

