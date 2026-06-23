import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

let accessToken: string | null = null

let readyResolve: (() => void) | null = null
let sessionReady = new Promise<void>((resolve) => {
  readyResolve = resolve
})

let refreshInFlight: Promise<string> | null = null
let bootstrapPromise: Promise<Session | null> | null = null

type TokenListener = (token: string | null) => void
const tokenListeners = new Set<TokenListener>()

function resetReadyGate(): void {
  sessionReady = new Promise<void>((resolve) => {
    readyResolve = resolve
  })
}

const EXPIRY_SKEW_SEC = 60

function isExpiringSoon(expiresAtSec: number | undefined): boolean {
  if (!expiresAtSec) return false
  return expiresAtSec * 1000 < Date.now() + EXPIRY_SKEW_SEC * 1000
}

async function refreshIfNeeded(session: Session): Promise<Session> {
  if (!isExpiringSoon(session.expires_at)) return session

  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) {
    const stillValid = (session.expires_at ?? 0) * 1000 > Date.now()
    if (!stillValid) {
      await supabase.auth.signOut().catch(() => {})
      throw new Error('Сессия истекла — войдите снова')
    }
    return session
  }
  return data.session
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  tokenListeners.forEach((fn) => fn(token))
}

export function onAccessTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
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
    setAccessToken(data.session.access_token)
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
  bootstrapPromise = null
  resetReadyGate()
}

/**
 * Один раз при старте приложения: читаем сессию из storage, при необходимости refresh.
 * Избегает гонок StrictMode и двойного INITIAL_SESSION в onAuthStateChange.
 */
export async function bootstrapAuthSession(): Promise<Session | null> {
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setAccessToken(null)
        return null
      }

      const fresh = await refreshIfNeeded(session)
      setAccessToken(fresh.access_token)
      return fresh
    } catch {
      setAccessToken(null)
      return null
    } finally {
      markSessionReady()
    }
  })()

  return bootstrapPromise
}

export async function resolveAccessToken(): Promise<string> {
  await sessionReady

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Необходимо войти в аккаунт')
  }

  if (isExpiringSoon(session.expires_at)) {
    return ensureFreshAccessToken()
  }

  setAccessToken(session.access_token)
  return session.access_token
}
