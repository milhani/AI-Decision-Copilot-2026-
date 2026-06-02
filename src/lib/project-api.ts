import { apiGet, apiPost } from '@/lib/api-client'
import type { Hypothesis, PostWithMetrics, Project } from '@/types/database'

export interface ProjectBundle {
  project: Project
  posts: PostWithMetrics[]
  hypotheses: Hypothesis[]
}

/** Один HTTP-запрос на projectId, пока предыдущий не завершён (Strict Mode, несколько хуков) */
const inflight = new Map<string, Promise<ProjectBundle>>()

export function clearProjectBundleInflight(projectId: string): void {
  inflight.delete(projectId)
}

export async function fetchProjectBundle(projectId: string): Promise<ProjectBundle> {
  const pending = inflight.get(projectId)
  if (pending) return pending

  const promise = apiGet<ProjectBundle>(`/api/projects/${projectId}/bundle`).finally(() => {
    inflight.delete(projectId)
  })

  inflight.set(projectId, promise)
  return promise
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  try {
    await apiPost(`/api/projects/${projectId}/invalidate-cache`)
  } catch {
    // не блокируем UI
  }
}

export async function reloadProjectBundle(projectId: string): Promise<ProjectBundle> {
  clearProjectBundleInflight(projectId)
  await invalidateProjectCache(projectId)
  return fetchProjectBundle(projectId)
}
