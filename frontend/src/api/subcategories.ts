import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { ExpenseSubCategory } from '../data/types';

/**
 * 子分类 API 调用
 * - 默认分类（isDefault=true）：project_id=NULL，所有项目可见
 * - 项目专属分类：project_id=当前项目ID，仅该项目可见
 */

// 获取子分类列表（默认+项目专属）
export async function fetchSubCategories(projectId: string): Promise<ExpenseSubCategory[]> {
  const result = await apiGet<any[]>(`/api/projects/${projectId}/subcategories`);
  return result.map(s => ({
    id: s.id,
    name: s.name,
    categoryId: s.category_id,
    isDefault: s.is_default,
  }));
}

// 新增子分类（仅当前项目可见）
export async function createSubCategory(
  projectId: string,
  name: string,
  categoryId: string
): Promise<ExpenseSubCategory> {
  const result = await apiPost<any>(`/api/projects/${projectId}/subcategories`, {
    name,
    category_id: categoryId,
  });
  return {
    id: result.id,
    name: result.name,
    categoryId: result.category_id,
    isDefault: result.is_default,
  };
}

// 更新子分类（重命名/移动）
export async function updateSubCategory(
  projectId: string,
  subId: string,
  data: { name?: string; categoryId?: string }
): Promise<ExpenseSubCategory> {
  const body: any = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.categoryId !== undefined) body.category_id = data.categoryId;

  const result = await apiPut<any>(`/api/projects/${projectId}/subcategories/${subId}`, body);
  return {
    id: result.id,
    name: result.name,
    categoryId: result.category_id,
    isDefault: result.is_default,
  };
}

// 删除子分类（需检查引用，不允许删除默认分类）
export async function deleteSubCategoryApi(
  projectId: string,
  subId: string
): Promise<void> {
  await apiDelete(`/api/projects/${projectId}/subcategories/${subId}`);
}
