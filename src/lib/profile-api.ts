import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { UserProfile } from '@/types/database'

export async function fetchUserProfile(refresh = false): Promise<UserProfile | null> {
  const q = refresh ? '?refresh=1' : ''
  return apiGet<UserProfile | null>(`/api/me/profile${q}`)
}

export async function updateUserProfile(
  patch: Partial<
    Pick<UserProfile, 'onboarding_completed' | 'onboarding_track'>
  >,
): Promise<UserProfile> {
  return apiPatch<UserProfile>('/api/me/profile', patch)
}

export async function invalidateUserProfileCache(): Promise<void> {
  try {
    await apiPost('/api/me/profile/invalidate-cache')
  } catch {
    // не блокируем UI
  }
}
