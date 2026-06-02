import { supabase } from '@/lib/supabase'

let accessToken: string | null = null

let readyResolve: (() => void) | null = null
let sessionReady = new Promise<void>((resolve) => {
  readyResolve = resolve
})

let refreshInFlight: Promise<string> | null = null

function resetReadyGate(): void {
  sessionReady = new Promise<void>((resolve) => {
    readyResolve = resolve
  })
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** Сброс кэша перед повтором запроса после 401 */
export function clearCachedAccessToken(): void {
  accessToken = null
}

/** Один refresh на все параллельные 401 */
export async function ensureFreshAccessToken(): Promise<string> {
  await sessionReady

  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.access_token) {
      throw new Error('Сессия истекла — войдите снова')
    }
    accessToken = data.session.access_token
    return data.session.access_token
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

/** @deprecated используйте ensureFreshAccessToken */
export async function forceRefreshAccessToken(): Promise<string> {
  clearCachedAccessToken()
  return ensureFreshAccessToken()
}

export function getAccessToken(): string | null {
  return accessToken
}

export function markSessionReady(): void {
  readyResolve?.()
  readyResolve = null
}

export function resetSessionReady(): void {
  accessToken = null
  refreshInFlight = null
  resetReadyGate()
}

const EXPIRY_SKEW_SEC = 60

function isExpiringSoon(expiresAtSec: number | undefined): boolean {
  if (!expiresAtSec) return false
  return expiresAtSec * 1000 < Date.now() + EXPIRY_SKEW_SEC * 1000
}

export async function resolveAccessToken(): Promise<string> {
  await sessionReady

  if (accessToken) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token === accessToken && !isExpiringSoon(session.expires_at)) {
      return accessToken
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Необходимо войти в аккаунт')
  }

  if (isExpiringSoon(session.expires_at)) {
    return ensureFreshAccessToken()
  }

  accessToken = session.access_token
  return session.access_token
}
