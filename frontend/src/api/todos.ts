import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface TodoData {
  id: string;
  project_id: string;
  title: string;
  stage_id: string;
  due_date?: string | null;
  completed: boolean;
  created_at: string;
}

/** 获取项目的所有待办事项 */
export async function fetchTodos(projectId: string): Promise<TodoData[]> {
  return apiGet(`/api/projects/${projectId}/todos`);
}

/** 创建待办事项 */
export async function createTodo(
  projectId: string,
  data: { title: string; stage_id?: string; due_date?: string | null }
): Promise<TodoData> {
  return apiPost(`/api/projects/${projectId}/todos`, data);
}

/** 更新待办事项 */
export async function updateTodoApi(
  projectId: string,
  todoId: string,
  data: { title?: string; stage_id?: string; due_date?: string | null; completed?: boolean }
): Promise<TodoData> {
  return apiPut(`/api/projects/${projectId}/todos/${todoId}`, data);
}

/** 删除待办事项 */
export async function deleteTodoApi(projectId: string, todoId: string): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/todos/${todoId}`);
}
