import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { PurchaseReferenceStage, CompareItem } from '../data/types';

/** 获取采购参考数据（项目专属：公共物品 + 当前项目私有物品） */
export async function fetchPurchaseReferences(projectId: string): Promise<PurchaseReferenceStage[]> {
  return apiGet(`/api/purchase/references?project_id=${encodeURIComponent(projectId)}`);
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

/** Get purchased items with expense mapping for a project */
export async function fetchPurchasedItems(projectId: string): Promise<{ item_id: string; expense_id: string | null }[]> {
  return apiGet(`/api/projects/${projectId}/purchase/purchased`);
}

/** Toggle an item's purchased status.
 *  When adding to purchased, optionally pass price and category_id
 *  (auto-creates an expense record on the backend).
 *  When removing from purchased, optionally pass delete_expense to
 *  also delete the associated expense record.
 */
export async function togglePurchasedItem(
  projectId: string,
  itemId: string,
  body?: { price?: number; category_id?: string | null; delete_expense?: boolean },
): Promise<{ purchased: boolean; expense_id?: string }> {
  return apiPut(`/api/projects/${projectId}/purchase/purchased/${itemId}`, body || {});
}

/** Toggle needs_compare flag on a purchase item */
export async function toggleItemCompare(
  projectId: string,
  itemId: string,
): Promise<{ needs_compare: boolean }> {
  return apiPut(`/api/projects/${projectId}/purchase/toggle-compare/${itemId}`, {});
}

/** Get comparison data for a specific purchase item */
export async function fetchItemComparison(projectId: string, itemId: string): Promise<CompareItem | null> {
  return apiGet(`/api/projects/${projectId}/purchase/items/${itemId}/comparison`);
}

/** Get compare item IDs for a project */
export async function fetchProjectCompareIds(projectId: string): Promise<string[]> {
  return apiGet(`/api/projects/${projectId}/purchase/compare-ids`);
}

/** Batch update purchase item categories */
export interface BatchCategoryItem {
  item_id: string;
  category_id: string | null;
  sub_category_id: string | null;
}

export async function batchUpdateCategories(
  items: BatchCategoryItem[],
): Promise<{ updated: number; skipped: number }> {
  return apiPut(`/api/purchase/items/batch-category`, { items });
}
