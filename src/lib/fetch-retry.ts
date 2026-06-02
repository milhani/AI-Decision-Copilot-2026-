const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 400

export function isRetryableHttpStatus(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || (status >= 500 && status < 600)
}

export function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    const m = err.message.toLowerCase()
    return (
      m.includes('failed to fetch') ||
      m.includes('network') ||
      m.includes('load failed') ||
      m.includes('econnreset')
    )
  }
  return false
}

export function backoffMs(attempt: number, baseMs = DEFAULT_BASE_DELAY_MS): number {
  return baseMs * attempt + Math.floor(Math.random() * 120)
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type WithRetryOptions = {
  maxAttempts?: number
  baseDelayMs?: number
  /** Вернуть false, чтобы не повторять */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      const defaultRetry =
        isRetryableNetworkError(error) ||
        (error instanceof HttpResponseError && isRetryableHttpStatus(error.status))
      const canRetry =
        attempt < maxAttempts && (options.shouldRetry?.(error, attempt) ?? defaultRetry)

      if (!canRetry) throw error
      await sleep(backoffMs(attempt, baseDelayMs))
    }
  }

  throw lastError
}

export class HttpResponseError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpResponseError'
    this.status = status
  }
}
