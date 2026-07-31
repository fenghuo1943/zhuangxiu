import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { PurchaseReferenceStage, CompareItem } from '../data/types';

/** 获取采购参考数据（项目专属：公共物品 + 当前项目私有物品） */
export async function fetchPurchaseReferences(projectId: string): Promise<PurchaseReferenceStage[]> {
  return apiGet(`/api/purchase/references?project_id=${encodeURIComponent(projectId)}`);
}

/** Get selected item IDs + expense IDs for a project */
export async function fetchSelectedPurchases(projectId: string): Promise<{ item_id: string; expense_id: string | null }[]> {
  return apiGet(`/api/projects/${projectId}/purchase/selected`);
}

/** Toggle a purchase item's selected state.
 *  When removing from 待购, pass delete_expense=true to also delete the linked unpaid bill. */
export async function togglePurchaseSelection(
  projectId: string,
  itemId: string,
  deleteExpense?: boolean,
): Promise<{ selected: boolean }> {
  const params = deleteExpense ? '?delete_expense=true' : '';
  return apiPut(`/api/projects/${projectId}/purchase/selected/${itemId}${params}`);
}

/** Add a custom purchase item (auto-selects it).
 *  If price is provided, an unpaid expense record is auto-created. */
export async function addCustomPurchaseItem(
  projectId: string,
  data: { name: string; stage_parent: string; subgroup_name?: string; spec?: string; qty?: number; unit?: string; category_id?: string | null; sub_category_id?: string | null; price?: number },
): Promise<{ id: string; name: string; spec?: string; qty: number; unit: string; selected: boolean; expense_id?: string | null }> {
  return apiPost(`/api/projects/${projectId}/purchase/custom`, data);
}

/** Delete a purchase item (custom items only are deleted on backend).
 *  Pass delete_expense=true to also delete the linked unpaid bill. */
export async function deletePurchaseItem(projectId: string, itemId: string, deleteExpense?: boolean): Promise<void> {
  const params = deleteExpense ? '?delete_expense=true' : '';
  return apiDelete(`/api/projects/${projectId}/purchase/items/${itemId}${params}`);
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

/** Update item price (smart cascade: updates quote if bound, expense otherwise) */
export interface UpdateItemPriceResult {
  item_id: string;
  price: number;
  updated_targets: string[];
  quote_id: string | null;
  expense_id: string | null;
}

export async function updateItemPrice(
  projectId: string,
  itemId: string,
  price: number,
): Promise<UpdateItemPriceResult> {
  return apiPut(`/api/projects/${projectId}/purchase/items/${itemId}/price`, { price });
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
