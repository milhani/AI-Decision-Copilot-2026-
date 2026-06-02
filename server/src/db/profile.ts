import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import type { UserProfile } from '../types.js'

export async function loadUserProfile(userId: string): Promise<{
  profile: UserProfile | null
  dbMs: number
}> {
  const { data: profile, ms } = await timed('user_profiles.select', async () => {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data as UserProfile

    const { data: created, error: insertError } = await admin
      .from('user_profiles')
      .insert({ id: userId })
      .select('*')
      .single()

    if (insertError) throw new Error(insertError.message)
    return created as UserProfile
  })

  return { profile, dbMs: ms }
}

export async function updateUserProfile(
  userId: string,
  patch: {
    onboarding_completed?: boolean
    onboarding_track?: 'analytics' | 'hypothesis' | null
  },
): Promise<{ profile: UserProfile; dbMs: number }> {
  const { data: profile, ms } = await timed('user_profiles.update', async () => {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin
      .from('user_profiles')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as UserProfile
  })

  return { profile, dbMs: ms }
}
