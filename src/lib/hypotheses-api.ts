import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { Hypothesis, HypothesisStatus } from '@/types/database'

export type HypothesisPayload = {
  title: string
  description?: string | null
  status: HypothesisStatus
  kpi_name?: string | null
  baseline_value?: number | null
  target_value?: number | null
  deadline?: string | null
  tags?: string[]
  linked_post_ids?: string[]
  result_summary?: string | null
  actual_value?: number | null
  closed_at?: string | null
}

export async function fetchHypothesis(
  projectId: string,
  hypothesisId: string,
): Promise<Hypothesis> {
  return apiGet<Hypothesis>(`/api/projects/${projectId}/hypotheses/${hypothesisId}`)
}

export async function createHypothesis(
  projectId: string,
  payload: HypothesisPayload,
): Promise<Hypothesis> {
  return apiPost<Hypothesis>(`/api/projects/${projectId}/hypotheses`, payload)
}

export async function updateHypothesis(
  projectId: string,
  hypothesisId: string,
  payload: HypothesisPayload,
): Promise<Hypothesis> {
  return apiPatch<Hypothesis>(
    `/api/projects/${projectId}/hypotheses/${hypothesisId}`,
    payload,
  )
}
