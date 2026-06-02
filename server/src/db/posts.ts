import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { assertProjectOwner } from './ownership.js'

export async function updatePostNote(
  projectId: string,
  postId: string,
  userId: string,
  manualNote: string | null,
): Promise<{ dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { ms } = await timed('posts.update_note', async () => {
    const admin = getSupabaseAdmin()

    const { data: post, error: findError } = await admin
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (findError) throw new Error(findError.message)
    if (!post) throw new Error('Пост не найден')

    const { error } = await admin
      .from('posts')
      .update({ manual_note: manualNote })
      .eq('id', postId)

    if (error) throw new Error(error.message)
  })

  return { dbMs: ms }
}
