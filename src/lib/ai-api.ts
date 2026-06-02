import { fetchWithAuth } from '@/lib/api-client'
import { HttpResponseError, backoffMs, isRetryableHttpStatus, sleep } from '@/lib/fetch-retry'
import { ensureFreshAccessToken } from '@/lib/auth-session'
import type { AiMessage } from '@/types/database'

const STREAM_MAX_ATTEMPTS = 3

export async function saveAiSession(
  projectId: string,
  mode: string,
  messages: AiMessage[],
): Promise<void> {
  const body = JSON.stringify({ mode, messages })
  const res = await fetchWithAuth(
    `/api/projects/${projectId}/ai/sessions`,
    { method: 'POST' },
    { getBody: () => body },
  )
  const parsed = (await res.json().catch(() => ({}))) as { ok?: boolean; warning?: string }
  if (parsed.warning) {
    console.warn('[saveAiSession]', parsed.warning)
  }
}

export type StreamAiHandlers = {
  onDelta: (text: string) => void
}

async function readSseStream(
  res: Response,
  handlers: StreamAiHandlers,
): Promise<{ content: string; confidence: string }> {
  if (!res.body) {
    throw new Error('Пустой ответ от сервера')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let confidence = 'средняя'

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let sep = buffer.indexOf('\n\n')
      while (sep >= 0) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)

        for (const line of block.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const raw = trimmed.slice(5).trim()
          if (!raw) continue

          const event = JSON.parse(raw) as {
            type: string
            text?: string
            content?: string
            confidence?: string
            error?: string
          }

          if (event.type === 'delta' && event.text) {
            full += event.text
            handlers.onDelta(event.text)
          }
          if (event.type === 'done') {
            full = event.content ?? full
            confidence = event.confidence ?? confidence
          }
          if (event.type === 'error') {
            throw new Error(event.error ?? 'Ошибка AI')
          }
        }

        sep = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { content: full, confidence }
}

function shouldRetryStream(error: unknown, receivedDelta: boolean): boolean {
  if (receivedDelta) return false
  if (error instanceof HttpResponseError) {
    return isRetryableHttpStatus(error.status)
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : ''
  return msg.includes('401') || msg.includes('сессия') || msg.includes('failed to fetch')
}

/** Потоковый ответ SSE — при 401 обновляет токен и повторяет запрос */
export async function streamAiAssistant(
  projectId: string,
  payload: object,
  handlers: StreamAiHandlers,
): Promise<{ content: string; confidence: string }> {
  const path = `/api/projects/${projectId}/ai/chat?stream=1`
  const getBody = () => JSON.stringify(payload)
  let receivedDelta = false
  let lastError: unknown

  const wrappedHandlers: StreamAiHandlers = {
    onDelta: (text) => {
      receivedDelta = true
      handlers.onDelta(text)
    },
  }

  for (let attempt = 1; attempt <= STREAM_MAX_ATTEMPTS; attempt++) {
    receivedDelta = false

    try {
      const res = await fetchWithAuth(
        path,
        {
          method: 'POST',
          headers: { Accept: 'text/event-stream' },
        },
        { getBody },
      )

      return await readSseStream(res, wrappedHandlers)
    } catch (error) {
      lastError = error

      if (!shouldRetryStream(error, receivedDelta) || attempt >= STREAM_MAX_ATTEMPTS) {
        throw error
      }

      if (
        error instanceof HttpResponseError &&
        error.status === 401
      ) {
        await ensureFreshAccessToken()
      }

      await sleep(backoffMs(attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Ошибка AI')
}

/** Имитация печати в демо-режиме */
export async function typewriterMock(
  text: string,
  onDelta: (chunk: string) => void,
  chunkSize = 4,
  delayMs = 14,
): Promise<void> {
  for (let i = 0; i < text.length; i += chunkSize) {
    await new Promise((r) => setTimeout(r, delayMs))
    onDelta(text.slice(i, i + chunkSize))
  }
}
