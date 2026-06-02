import { getSupabaseAdmin } from '../supabase-admin.js'

export async function assertProjectOwner(
  projectId: string,
  userId: string,
): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Проект не найден')
}
