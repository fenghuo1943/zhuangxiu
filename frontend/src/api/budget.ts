import { apiGet, apiPut } from './client';
import type { BudgetCategory } from '../data/types';

interface BudgetApiResponse {
  total: number;
  categories: Array<{
    id: string;
    project_id: string;
    name: string;
    color: string;
    allocated: number;
    spent: number;
  }>;
}

interface BudgetCategoryApiResponse {
  id: string;
  project_id: string;
  name: string;
  color: string;
  allocated: number;
  spent: number;
}

export interface BudgetData {
  total: number;
  categories: BudgetCategory[];
}

function fromApiCategory(c: BudgetCategoryApiResponse): BudgetCategory {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    allocated: c.allocated,
    spent: c.spent,
  };
}

export async function fetchBudget(projectId: string): Promise<BudgetData> {
  const data: BudgetApiResponse = await apiGet(`/api/projects/${projectId}/budget`);
  return {
    total: data.total,
    categories: data.categories.map(fromApiCategory),
  };
}

export async function updateBudgetTotal(projectId: string, total: number): Promise<BudgetData> {
  const data: BudgetApiResponse = await apiPut(`/api/projects/${projectId}/budget`, { total });
  return {
    total: data.total,
    categories: data.categories.map(fromApiCategory),
  };
}

export async function updateCategoryAllocation(
  projectId: string,
  categoryId: string,
  allocated: number,
): Promise<BudgetCategory> {
  const data: BudgetCategoryApiResponse = await apiPut(
    `/api/projects/${projectId}/budget/${categoryId}`,
    { allocated },
  );
  return fromApiCategory(data);
}
