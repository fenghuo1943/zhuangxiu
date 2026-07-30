import { apiGet, apiPut, apiPost } from './client';
import type { CompareItem } from '../data/types';

/** List all compare items for a project (items with needs_compare + their models) */
export async function fetchCompareItems(projectId: string): Promise<CompareItem[]> {
  return apiGet(`/api/projects/${projectId}/compare`);
}

/** Add item to compare (same as purchase custom add + needs_compare flag) */
export async function addCompareItemApi(
  projectId: string,
  data: { name: string; stage_parent: string; subgroup_name?: string; spec?: string; qty?: number; unit?: string },
): Promise<CompareItem> {
  return apiPost(`/api/projects/${projectId}/compare`, data);
}

/** Toggle model sync to purchase list */
export async function toggleModelSyncApi(
  projectId: string,
  modelId: string,
): Promise<{ synced: boolean; auto_purchased: number }> {
  return apiPut(`/api/projects/${projectId}/compare/models/${modelId}/sync`);
}

/** Create a price model for an item */
export async function createModelApi(
  projectId: string,
  itemId: string,
  data: { name: string; spec?: string; note?: string; quantity?: number },
): Promise<import('../data/types').PriceModel> {
  return apiPost(`/api/projects/${projectId}/compare/items/${itemId}/models`, data);
}

/** Create a channel quote for a model */
export async function createQuoteApi(
  projectId: string,
  modelId: string,
  data: { channel: string; price?: number; url?: string; note?: string },
): Promise<import('../data/types').ChannelQuote> {
  return apiPost(`/api/projects/${projectId}/compare/models/${modelId}/quotes`, data);
}

/** Set best quote for a model (persisted to backend) */
export async function setBestQuoteApi(
  projectId: string,
  modelId: string,
  quoteId: string | null,
): Promise<{ best_quote_id: string | null }> {
  return apiPut(`/api/projects/${projectId}/compare/models/${modelId}/best-quote`, { quote_id: quoteId });
}
