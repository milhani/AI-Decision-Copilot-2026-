import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { UserProfile } from '@/types/database'

const PROFILE_CACHE_KEY = 'smm:user-profile'

let inflight: Promise<UserProfile | null> | null = null
let inflightRefresh = false

export function readProfileCache(userId: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId: string; profile: UserProfile }
    return parsed.userId === userId ? parsed.profile : null
  } catch {
    return null
  }
}

export function writeProfileCache(userId: string, profile: UserProfile | null): void {
  try {
    if (!profile) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY)
      return
    }
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }))
  } catch {
    // sessionStorage может быть недоступен
  }
}

export function clearProfileCache(): void {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // ignore
  }
}

export async function fetchUserProfile(refresh = false): Promise<UserProfile | null> {
  if (!refresh && inflight && !inflightRefresh) {
    return inflight
  }

  const q = refresh ? '?refresh=1' : ''
  inflightRefresh = refresh
  inflight = apiGet<UserProfile | null>(`/api/me/profile${q}`).finally(() => {
    inflight = null
    inflightRefresh = false
  })

  return inflight
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
