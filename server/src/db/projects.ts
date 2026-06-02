import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import type { Project } from '../types.js'

const MAX_PROJECTS = 10

export type ProjectWritePayload = {
  name: string
  description?: string | null
  niche_tags?: string[]
  channels?: string[]
  optional_goal_text?: string | null
  optional_kpi_list?: string[] | null
  is_demo?: boolean
}

export async function listProjects(userId: string): Promise<{ projects: Project[]; dbMs: number }> {
  const { data: projects, ms } = await timed('projects.list', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []) as Project[]
  })

  return { projects, dbMs: ms }
}

export async function getProject(
  projectId: string,
  userId: string,
): Promise<{ project: Project | null; dbMs: number }> {
  const { data: project, ms } = await timed('projects.get', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data as Project | null
  })

  return { project, dbMs: ms }
}

export async function countProjects(userId: string): Promise<number> {
  const admin = getSupabaseAdmin()
  const { count, error } = await admin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function createProject(
  userId: string,
  payload: ProjectWritePayload,
): Promise<{ project: Project; dbMs: number }> {
  const n = await countProjects(userId)
  if (n >= MAX_PROJECTS) {
    throw new Error(`Достигнут лимит: максимум ${MAX_PROJECTS} проектов`)
  }

  const { data: project, ms } = await timed('projects.insert', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('projects')
      .insert({
        user_id: userId,
        name: payload.name,
        description: payload.description ?? null,
        niche_tags: payload.niche_tags ?? [],
        channels: payload.channels ?? [],
        optional_goal_text: payload.optional_goal_text ?? null,
        optional_kpi_list: payload.optional_kpi_list ?? null,
        is_demo: payload.is_demo ?? false,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as Project
  })

  return { project, dbMs: ms }
}

export async function updateProject(
  projectId: string,
  userId: string,
  payload: ProjectWritePayload,
): Promise<{ project: Project; dbMs: number }> {
  const { data: project, ms } = await timed('projects.update', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('projects')
      .update({
        name: payload.name,
        description: payload.description ?? null,
        niche_tags: payload.niche_tags ?? [],
        channels: payload.channels ?? [],
        optional_goal_text: payload.optional_goal_text ?? null,
        optional_kpi_list: payload.optional_kpi_list ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as Project
  })

  return { project, dbMs: ms }
}

export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<{ dbMs: number }> {
  const { ms } = await timed('projects.delete', async () => {
    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  })

  return { dbMs: ms }
}
