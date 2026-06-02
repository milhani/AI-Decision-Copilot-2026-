import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { Project } from '@/types/database'

export type ProjectPayload = {
  name: string
  description?: string | null
  niche_tags?: string[]
  channels?: string[]
  optional_goal_text?: string | null
  optional_kpi_list?: string[] | null
}

export async function listProjects(): Promise<Project[]> {
  return apiGet<Project[]>('/api/projects')
}

export async function getProject(projectId: string): Promise<Project> {
  return apiGet<Project>(`/api/projects/${projectId}`)
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  return apiPost<Project>('/api/projects', payload)
}

export async function updateProject(
  projectId: string,
  payload: ProjectPayload,
): Promise<Project> {
  return apiPatch<Project>(`/api/projects/${projectId}`, payload)
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiDelete(`/api/projects/${projectId}`)
}

export async function createDemoProject(): Promise<string> {
  const { projectId } = await apiPost<{ projectId: string }>('/api/projects/demo')
  return projectId
}
