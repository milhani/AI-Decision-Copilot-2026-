import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { assertProjectOwner } from './ownership.js'
import type { Hypothesis } from '../types.js'

export type HypothesisWritePayload = {
  title: string
  description?: string | null
  status: string
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

export async function getHypothesis(
  projectId: string,
  hypothesisId: string,
  userId: string,
): Promise<{ hypothesis: Hypothesis | null; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { data: hypothesis, ms } = await timed('hypotheses.get', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('hypotheses')
      .select('*')
      .eq('id', hypothesisId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data as Hypothesis | null
  })

  return { hypothesis, dbMs: ms }
}

export async function createHypothesis(
  projectId: string,
  userId: string,
  payload: HypothesisWritePayload,
): Promise<{ hypothesis: Hypothesis; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { data: hypothesis, ms } = await timed('hypotheses.insert', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('hypotheses')
      .insert({ project_id: projectId, ...payload })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as Hypothesis
  })

  return { hypothesis, dbMs: ms }
}

export async function updateHypothesis(
  projectId: string,
  hypothesisId: string,
  userId: string,
  payload: HypothesisWritePayload,
): Promise<{ hypothesis: Hypothesis; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { data: hypothesis, ms } = await timed('hypotheses.update', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('hypotheses')
      .update(payload)
      .eq('id', hypothesisId)
      .eq('project_id', projectId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as Hypothesis
  })

  return { hypothesis, dbMs: ms }
}
