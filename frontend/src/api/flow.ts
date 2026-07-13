import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { StageNote, CustomFlowStep } from '../data/types';

// ==================== Flow Progress ====================

export interface FlowProgressResponse {
  project_id: string;
  flow_type: string;
  done_step_ids: string[];
  custom_order: string[] | null;
}

export async function fetchFlowProgress(projectId: string): Promise<FlowProgressResponse> {
  return apiGet<FlowProgressResponse>(`/api/projects/${projectId}/flow`);
}

export async function updateFlowProgress(projectId: string, data: {
  flow_type?: string;
  done_step_ids?: string[];
  custom_order?: string[] | null;
}): Promise<FlowProgressResponse> {
  return apiPut<FlowProgressResponse>(`/api/projects/${projectId}/flow`, data);
}

export async function toggleStepDone(projectId: string, stepId: string): Promise<{ done_step_ids: string[] }> {
  return apiPut<{ done_step_ids: string[] }>(`/api/projects/${projectId}/flow/steps/${stepId}/done`);
}

// ==================== Stage Notes ====================

export async function fetchStageNotes(projectId: string, stageId: string): Promise<StageNote[]> {
  return apiGet<StageNote[]>(`/api/projects/${projectId}/flow/stages/${stageId}/notes`);
}

export async function createStageNote(projectId: string, stageId: string, content: string): Promise<StageNote> {
  return apiPost<StageNote>(`/api/projects/${projectId}/flow/stages/${stageId}/notes`, {
    stage_id: stageId,
    content,
  });
}

export async function updateStageNote(projectId: string, stageId: string, noteId: string, content: string): Promise<StageNote> {
  return apiPut<StageNote>(`/api/projects/${projectId}/flow/stages/${stageId}/notes/${noteId}`, { content });
}

export async function deleteStageNote(projectId: string, stageId: string, noteId: string): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/flow/stages/${stageId}/notes/${noteId}`);
}

// ==================== Custom Flow Steps ====================

export async function fetchCustomSteps(projectId: string, flowType: string): Promise<CustomFlowStep[]> {
  return apiGet<CustomFlowStep[]>(`/api/projects/${projectId}/flow/custom-steps?flow_type=${flowType}`);
}

export async function createCustomStep(projectId: string, data: {
  flow_type: string;
  title: string;
  days: string;
  desc: string;
  sort_order: number;
}): Promise<CustomFlowStep> {
  return apiPost<CustomFlowStep>(`/api/projects/${projectId}/flow/custom-steps`, data);
}

export async function updateCustomStep(projectId: string, stepId: string, data: {
  title?: string;
  days?: string;
  desc?: string;
  sort_order?: number;
}): Promise<CustomFlowStep> {
  return apiPut<CustomFlowStep>(`/api/projects/${projectId}/flow/custom-steps/${stepId}`, data);
}

export async function deleteCustomStep(projectId: string, stepId: string): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/flow/custom-steps/${stepId}`);
}
