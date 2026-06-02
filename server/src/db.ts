import { timed } from './logger.js'
import { getSupabaseAdmin } from './supabase-admin.js'
import type { Post, ProjectBundle } from './types.js'

function withLatestMetric<T extends { post_metrics?: Post['post_metrics'] }>(post: T): T {
  const metrics = post.post_metrics ?? []
  if (metrics.length <= 1) return post
  const sorted = [...metrics].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  )
  return { ...post, post_metrics: [sorted[0]] }
}

export async function loadProjectBundle(
  projectId: string,
  userId: string,
): Promise<{ bundle: ProjectBundle | null; dbMs: number }> {
  const { data: bundle, ms } = await timed('project_bundle.load', async () => {
    const admin = getSupabaseAdmin()

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .maybeSingle()

    if (projectError) throw new Error(projectError.message)
    if (!project) return null

    const [postsResult, hypothesesResult] = await Promise.all([
      admin
        .from('posts')
        .select('*, post_metrics(*)')
        .eq('project_id', projectId)
        .order('published_at', { ascending: true }),
      admin
        .from('hypotheses')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])

    if (postsResult.error) throw new Error(postsResult.error.message)
    if (hypothesesResult.error) throw new Error(hypothesesResult.error.message)

    const posts = (postsResult.data ?? []).map((p) =>
      withLatestMetric(p as Post),
    ) as ProjectBundle['posts']

    return {
      project: project as ProjectBundle['project'],
      posts,
      hypotheses: (hypothesesResult.data ?? []) as ProjectBundle['hypotheses'],
    }
  })

  return { bundle, dbMs: ms }
}

export async function closeDb(): Promise<void> {
  // no-op
}
