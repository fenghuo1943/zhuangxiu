import { apiGet, apiPut, apiPost } from './client';
import type { CompareItem } from '../data/types';

/** List all compare items for a project (items with needs_compare + their models) */
export async function fetchCompareItems(projectId: string): Promise<CompareItem[]> {
  return apiGet(`/api/projects/${projectId}/compare`);
}

/** Add item to compare (same as purchase custom add + needs_compare flag) */
export async function addCompareItemApi(
  projectId: string,
  data: { name: string; stage_parent: string; subgroup_name?: string; spec?: string; qty?: number; unit?: string; category_id?: string | null; sub_category_id?: string | null },
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

/** Raw backend response for a price model (snake_case, matches backend PriceModelOut) */
export interface ModelApiResponse {
  id: string;
  item_id?: string | null;
  project_id?: string | null;
  name: string;
  spec?: string | null;
  note?: string | null;
  quantity?: number;
  best_quote_id?: string | null;
  synced?: boolean;
  quotes?: QuoteApiResponse[];
}

/** Raw backend response for a channel quote (snake_case, matches backend ChannelQuoteOut) */
export interface QuoteApiResponse {
  id: string;
  channel: string;
  price?: number | null;
  url?: string | null;
  note?: string | null;
  updated_at?: string | null;
}

/** Create a price model for an item */
export async function createModelApi(
  projectId: string,
  itemId: string,
  data: { name: string; spec?: string; note?: string; quantity?: number },
): Promise<ModelApiResponse> {
  return apiPost(`/api/projects/${projectId}/compare/items/${itemId}/models`, data);
}

/** Create a channel quote for a model */
export async function createQuoteApi(
  projectId: string,
  modelId: string,
  data: { channel: string; price?: number; url?: string; note?: string },
): Promise<QuoteApiResponse> {
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
