import { fetchWithAuth } from '@/lib/api-client'
import { HttpResponseError, backoffMs, isRetryableHttpStatus, sleep } from '@/lib/fetch-retry'
import { ensureFreshAccessToken } from '@/lib/auth-session'
import type { AiChatSnapshot, AiMessage, AiMode, AiSession } from '@/types/database'

const STREAM_MAX_ATTEMPTS = 3
const CHAT_LIST_CACHE_KEY = 'smm:ai-chat-list'

const listInflight = new Map<string, Promise<AiSession[]>>()

function listCacheKey(projectId: string, mode?: AiMode): string {
  return `${projectId}:${mode ?? 'all'}`
}

type ChatListCacheEntry = { chats: AiSession[]; fetched: boolean }

function readAllChatListCaches(): Record<string, ChatListCacheEntry> {
  try {
    const raw = sessionStorage.getItem(CHAT_LIST_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ChatListCacheEntry | AiSession[]>
    const out: Record<string, ChatListCacheEntry> = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        out[key] = { chats: val, fetched: val.length > 0 }
      } else if (val && Array.isArray(val.chats)) {
        out[key] = { chats: val.chats, fetched: Boolean(val.fetched) }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function readChatListCache(projectId: string, mode?: AiMode): AiSession[] | null {
  const all = readAllChatListCaches()
  const entry = all[listCacheKey(projectId, mode)]
  return entry?.fetched ? entry.chats : null
}

export function writeChatListCache(
  projectId: string,
  mode: AiMode | undefined,
  chats: AiSession[],
): void {
  try {
    const all = readAllChatListCaches()
    all[listCacheKey(projectId, mode)] = { chats, fetched: true }
    sessionStorage.setItem(CHAT_LIST_CACHE_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

export function upsertChatListItem(
  projectId: string,
  mode: AiMode,
  chat: AiSession,
): void {
  const cached = readChatListCache(projectId, mode) ?? []
  const idx = cached.findIndex((c) => c.id === chat.id)
  const next = [...cached]
  if (idx === -1) {
    next.unshift(chat)
  } else {
    next[idx] = chat
  }
  next.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  writeChatListCache(projectId, mode, next)
}

export function removeChatListItem(projectId: string, mode: AiMode, chatId: string): void {
  const cached = readChatListCache(projectId, mode)
  if (!cached) return
  writeChatListCache(
    projectId,
    mode,
    cached.filter((c) => c.id !== chatId),
  )
}

export async function listAiChats(
  projectId: string,
  mode?: AiMode,
  refresh = false,
): Promise<AiSession[]> {
  const key = listCacheKey(projectId, mode)

  if (!refresh) {
    const cached = readChatListCache(projectId, mode)
    if (cached) return cached

    if (listInflight.has(key)) {
      return listInflight.get(key)!
    }
  } else if (listInflight.has(key)) {
    return listInflight.get(key)!
  }

  const qs = new URLSearchParams()
  if (mode) qs.set('mode', mode)
  if (refresh) qs.set('refresh', '1')
  const query = qs.toString() ? `?${qs}` : ''

  const task = (async () => {
    const res = await fetchWithAuth(`/api/projects/${projectId}/ai/chats${query}`)
    const chats = (await res.json()) as AiSession[]
    writeChatListCache(projectId, mode, chats)
    return chats
  })()

  listInflight.set(key, task)
  try {
    return await task
  } finally {
    listInflight.delete(key)
  }
}

export async function getAiChat(projectId: string, chatId: string): Promise<AiSession> {
  const res = await fetchWithAuth(`/api/projects/${projectId}/ai/chats/${chatId}`)
  return res.json() as Promise<AiSession>
}

export async function createAiChat(
  projectId: string,
  payload: {
    mode: AiMode
    messages?: AiMessage[]
    title?: string
    context_snapshot?: AiChatSnapshot | null
  },
): Promise<AiSession> {
  const res = await fetchWithAuth(
    `/api/projects/${projectId}/ai/chats`,
    { method: 'POST' },
    { getBody: () => JSON.stringify(payload) },
  )
  const chat = (await res.json()) as AiSession
  upsertChatListItem(projectId, payload.mode, chat)
  return chat
}

export async function updateAiChat(
  projectId: string,
  chatId: string,
  payload: {
    mode?: AiMode
    messages?: AiMessage[]
    title?: string
    context_snapshot?: AiChatSnapshot | null
  },
): Promise<AiSession> {
  const res = await fetchWithAuth(
    `/api/projects/${projectId}/ai/chats/${chatId}`,
    { method: 'PUT' },
    { getBody: () => JSON.stringify(payload) },
  )
  const chat = (await res.json()) as AiSession
  if (payload.mode ?? chat.mode) {
    upsertChatListItem(projectId, payload.mode ?? chat.mode, chat)
  }
  return chat
}

export async function deleteAiChat(
  projectId: string,
  chatId: string,
  mode?: AiMode,
): Promise<void> {
  await fetchWithAuth(`/api/projects/${projectId}/ai/chats/${chatId}`, { method: 'DELETE' })
  if (mode) removeChatListItem(projectId, mode, chatId)
}

/** @deprecated */
export async function saveAiSession(
  projectId: string,
  mode: string,
  messages: AiMessage[],
): Promise<void> {
  await createAiChat(projectId, { mode: mode as AiMode, messages, context_snapshot: null })
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

      if (error instanceof HttpResponseError && error.status === 401) {
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
