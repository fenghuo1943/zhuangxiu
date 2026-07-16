import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { PurchaseReferenceStage } from '../data/types';

/** Fetch all purchase reference data (public, no auth needed) */
export async function fetchPurchaseReferences(): Promise<PurchaseReferenceStage[]> {
  return apiGet('/api/purchase/references');
}

/** Get selected item IDs for a project */
export async function fetchSelectedPurchases(projectId: string): Promise<string[]> {
  return apiGet(`/api/projects/${projectId}/purchase/selected`);
}

/** Toggle a purchase item's selected state */
export async function togglePurchaseSelection(
  projectId: string,
  itemId: string,
): Promise<{ selected: boolean }> {
  return apiPut(`/api/projects/${projectId}/purchase/selected/${itemId}`);
}

/** Add a custom purchase item (auto-selects it) */
export async function addCustomPurchaseItem(
  projectId: string,
  data: { name: string; stage_parent: string; subgroup_name?: string; spec?: string; qty?: number; unit?: string },
): Promise<{ id: string; name: string; spec?: string; qty: number; unit: string; selected: boolean }> {
  return apiPost(`/api/projects/${projectId}/purchase/custom`, data);
}

/** Delete a purchase item (custom items only are deleted on backend) */
export async function deletePurchaseItem(projectId: string, itemId: string): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/purchase/items/${itemId}`);
}

/** Get purchased item IDs for a project */
export async function fetchPurchasedItems(projectId: string): Promise<string[]> {
  return apiGet(`/api/projects/${projectId}/purchase/purchased`);
}

/** Toggle an item's purchased status */
export async function togglePurchasedItem(
  projectId: string,
  itemId: string,
): Promise<{ purchased: boolean }> {
  return apiPut(`/api/projects/${projectId}/purchase/purchased/${itemId}`);
}

/** Create a PriceCategory from a purchase item (item becomes 品类, user adds 型号 manually) */
export async function addPurchaseToCompareApi(
  projectId: string,
  data: { item_id: string; item_name: string; spec?: string; category_name: string; quantity: number },
): Promise<{ category_id: string; name: string }> {
  return apiPost(`/api/projects/${projectId}/purchase/add-to-compare`, data);
}
