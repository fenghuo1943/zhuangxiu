import { apiGet, apiPut } from './client';
import type { PriceCategory } from '../data/types';

/** List all price categories for a project */
export async function fetchPriceCategories(projectId: string): Promise<PriceCategory[]> {
  return apiGet(`/api/projects/${projectId}/compare`);
}

/** Toggle model sync to purchase list (now also triggers auto-purchase on backend) */
export async function toggleModelSyncApi(
  projectId: string,
  modelId: string,
): Promise<{ synced: boolean; auto_purchased: number }> {
  return apiPut(`/api/projects/${projectId}/compare/models/${modelId}/sync`);
}
