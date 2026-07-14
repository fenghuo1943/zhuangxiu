import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Expense } from '../data/types';

export interface ExpenseCreatePayload {
  title: string;
  amount: number;
  category_id: string;
  sub_category_id?: string;
  stage_id?: string;
  date: string;
  status: string;
  payer?: string;
  note?: string;
}

export interface ExpenseUpdatePayload {
  title?: string;
  amount?: number;
  category_id?: string;
  sub_category_id?: string;
  stage_id?: string;
  date?: string;
  status?: string;
  payer?: string;
  note?: string;
}

interface ExpenseResponse {
  id: string;
  project_id: string;
  title: string;
  amount: number;
  category_id: string;
  sub_category_id?: string;
  stage_id?: string;
  date: string;
  status: string;
  payer?: string;
  note?: string;
  created_at: string;
}

function fromApi(e: ExpenseResponse): Expense {
  return {
    id: e.id,
    projectId: e.project_id,
    title: e.title,
    amount: e.amount,
    categoryId: e.category_id,
    subCategoryId: e.sub_category_id,
    stageId: e.stage_id,
    date: e.date,
    status: e.status as Expense['status'],
    payer: e.payer,
    note: e.note,
    createdAt: e.created_at,
  };
}

export async function fetchExpenses(projectId: string, params?: { status?: string; q?: string }): Promise<Expense[]> {
  let path = `/api/projects/${projectId}/expenses`;
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.q) sp.set('q', params.q);
  const qs = sp.toString();
  if (qs) path += `?${qs}`;
  const list: ExpenseResponse[] = await apiGet(path);
  return list.map(fromApi);
}

export async function createExpenseApi(projectId: string, data: ExpenseCreatePayload): Promise<Expense> {
  const e: ExpenseResponse = await apiPost(`/api/projects/${projectId}/expenses`, data);
  return fromApi(e);
}

export async function updateExpenseApi(projectId: string, expenseId: string, data: ExpenseUpdatePayload): Promise<Expense> {
  const e: ExpenseResponse = await apiPut(`/api/projects/${projectId}/expenses/${expenseId}`, data);
  return fromApi(e);
}

export async function deleteExpenseApi(projectId: string, expenseId: string): Promise<void> {
  await apiDelete(`/api/projects/${projectId}/expenses/${expenseId}`);
}
