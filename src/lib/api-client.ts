import {
  HttpResponseError,
  backoffMs,
  isRetryableHttpStatus,
  isRetryableNetworkError,
  sleep,
} from '@/lib/fetch-retry'
import {
  clearCachedAccessToken,
  ensureFreshAccessToken,
  resolveAccessToken,
} from '@/lib/auth-session'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export { resolveAccessToken } from '@/lib/auth-session'

const MAX_ATTEMPTS = 3

export async function authHeaders(): Promise<HeadersInit> {
  const token = await resolveAccessToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return (body as { error?: string }).error ?? `Ошибка API (${res.status})`
}

function isAuthError(error: unknown, status?: number): boolean {
  if (status === 401) return true
  if (error instanceof HttpResponseError && error.status === 401) return true
  const msg = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    msg.includes('401') ||
    msg.includes('сессия истекла') ||
    msg.includes('authorization') ||
    msg.includes('jwt') ||
    msg.includes('войдите')
  )
}

async function recoverAuthAfter401(previousToken: string | null): Promise<void> {
  clearCachedAccessToken()
  const newToken = await ensureFreshAccessToken()
  if (previousToken && newToken === previousToken) {
    await sleep(150)
    clearCachedAccessToken()
    await ensureFreshAccessToken()
  }
}

export type FetchWithAuthOptions = {
  /** Пересоздаёт body на каждой попытке (для POST/SSE) */
  getBody?: () => BodyInit | null | undefined
}

/** fetch с повтором при 401/5xx и сетевых сбоях */
export async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
  options: FetchWithAuthOptions = {},
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let tokenUsed: string | null = null

    try {
      const token = await resolveAccessToken()
      tokenUsed = token

      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${token}`)

      const body = options.getBody ? options.getBody() : init.body
      if (body != null && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }

      const res = await fetch(`${API_URL}${path}`, { ...init, headers, body })

      if (res.ok) return res

      const status = res.status

      if (attempt < MAX_ATTEMPTS && status === 401) {
        await recoverAuthAfter401(tokenUsed)
        await sleep(backoffMs(attempt))
        continue
      }

      if (attempt < MAX_ATTEMPTS && isRetryableHttpStatus(status) && status !== 401) {
        await sleep(backoffMs(attempt))
        continue
      }

      throw new HttpResponseError(status, await parseError(res))
    } catch (error) {
      lastError = error

      if (error instanceof HttpResponseError) {
        if (attempt < MAX_ATTEMPTS && error.status === 401) {
          await recoverAuthAfter401(tokenUsed)
          await sleep(backoffMs(attempt))
          continue
        }
        throw error
      }

      if (attempt < MAX_ATTEMPTS && isAuthError(error)) {
        await recoverAuthAfter401(tokenUsed)
        await sleep(backoffMs(attempt))
        continue
      }

      if (attempt < MAX_ATTEMPTS && isRetryableNetworkError(error)) {
        await sleep(backoffMs(attempt))
        continue
      }

      throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Ошибка API')
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path)
  return res.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

export async function apiPost<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiDelete(path: string): Promise<void> {
  await fetchWithAuth(path, { method: 'DELETE' })
}
