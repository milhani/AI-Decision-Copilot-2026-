import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { assertProjectOwner } from './ownership.js'

export type StoredMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  confidence?: string
  timestamp?: string
}

export type AiChatSnapshot = {
  aiContext: unknown
  coachStep?: number
}

export type AiChatSummary = {
  id: string
  project_id: string
  mode: 'analyst' | 'coach' | 'chat'
  title: string | null
  created_at: string
  updated_at: string
}

export type AiChatRow = AiChatSummary & {
  messages: StoredMessage[]
  context_snapshot: AiChatSnapshot | null
}

const MAX_STORED_MESSAGES = 50
const MAX_STORED_CONTENT = 50_000
const MAX_TITLE = 120

/** Базовая схема без миграции title/context_snapshot */
const LIST_SELECT = 'id, project_id, mode, created_at, updated_at'
const FULL_SELECT = 'id, project_id, mode, messages, created_at, updated_at'

function normalizeMode(mode: string): 'analyst' | 'coach' | 'chat' {
  if (mode === 'analyst' || mode === 'coach' || mode === 'chat') return mode
  throw new Error(`Некорректный mode: ${mode}`)
}

export function normalizeMessages(messages: unknown): StoredMessage[] {
  if (!Array.isArray(messages)) return []

  return messages
    .map((raw) => {
      const m = raw as Record<string, unknown>
      if (m.streaming === true) return null
      const role = m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : null
      if (!role) return null

      const content = String(m.content ?? '').trim()
      if (!content) return null

      const row: StoredMessage = {
        role,
        content: content.slice(0, MAX_STORED_CONTENT),
      }
      if (typeof m.id === 'string') row.id = m.id.slice(0, 64)
      if (typeof m.confidence === 'string') row.confidence = m.confidence.slice(0, 32)
      if (typeof m.timestamp === 'string') row.timestamp = m.timestamp.slice(0, 64)
      return row
    })
    .filter((m): m is StoredMessage => m !== null)
    .slice(-MAX_STORED_MESSAGES)
}

export function deriveChatTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Новый диалог'
  const t = firstUser.content.replace(/\s+/g, ' ').trim()
  if (!t) return 'Новый диалог'
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE)}…` : t
}

function mapSummary(raw: Record<string, unknown>, messages?: StoredMessage[]): AiChatSummary {
  const msgs =
    messages ??
    (Array.isArray(raw.messages) ? normalizeMessages(raw.messages) : [])

  return {
    id: String(raw.id),
    project_id: String(raw.project_id),
    mode: raw.mode as AiChatSummary['mode'],
    title: msgs.length > 0 ? deriveChatTitle(msgs) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  }
}

function mapRow(raw: Record<string, unknown>): AiChatRow {
  const messages = Array.isArray(raw.messages)
    ? normalizeMessages(raw.messages)
    : []

  return {
    ...mapSummary(raw, messages),
    messages,
    context_snapshot: null,
  }
}

export function toApiListItem(summary: AiChatSummary): AiChatRow {
  return { ...summary, messages: [], context_snapshot: null }
}

export async function listAiChats(
  projectId: string,
  userId: string,
  mode?: string,
): Promise<{ chats: AiChatSummary[]; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { ms, data } = await timed('ai_chats.list', async () => {
    const admin = getSupabaseAdmin()
    let q = admin
      .from('ai_sessions')
      .select(LIST_SELECT)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(40)

    if (mode) {
      q = q.eq('mode', normalizeMode(mode))
    }

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapSummary(row as Record<string, unknown>))
  })

  return { chats: data, dbMs: ms }
}

export async function getAiChat(
  projectId: string,
  userId: string,
  chatId: string,
): Promise<{ chat: AiChatRow; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { ms, data } = await timed('ai_chats.get', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('ai_sessions')
      .select(FULL_SELECT)
      .eq('id', chatId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Диалог не найден')
    return mapRow(data as Record<string, unknown>)
  })

  return { chat: data, dbMs: ms }
}

export async function createAiChat(
  projectId: string,
  userId: string,
  payload: {
    mode: string
    messages?: unknown
    title?: string
    context_snapshot?: AiChatSnapshot | null
  },
): Promise<{ chat: AiChatRow; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const safeMode = normalizeMode(payload.mode)
  const safeMessages = normalizeMessages(payload.messages ?? [])

  const { ms, data } = await timed('ai_chats.create', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('ai_sessions')
      .insert({
        project_id: projectId,
        mode: safeMode,
        messages: safeMessages,
        updated_at: new Date().toISOString(),
      })
      .select(FULL_SELECT)
      .single()

    if (error) {
      throw formatAiSessionDbError(error.message, payload.mode)
    }
    return mapRow(data as Record<string, unknown>)
  })

  return { chat: data, dbMs: ms }
}

function formatAiSessionDbError(message: string, mode?: string): Error {
  const lower = message.toLowerCase()
  if (
    mode === 'chat' &&
    (lower.includes('ai_mode') || lower.includes('enum') || lower.includes('invalid input value'))
  ) {
    return new Error(
      'Режим «chat» не добавлен в БД. В Supabase → SQL Editor выполните: ALTER TYPE public.ai_mode ADD VALUE IF NOT EXISTS \'chat\';',
    )
  }
  return new Error(message)
}

export async function updateAiChat(
  projectId: string,
  userId: string,
  chatId: string,
  payload: {
    messages?: unknown
    title?: string
    context_snapshot?: AiChatSnapshot | null
  },
): Promise<{ chat: AiChatRow; dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (payload.messages !== undefined) {
    patch.messages = normalizeMessages(payload.messages)
  }

  const { ms, data } = await timed('ai_chats.update', async () => {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('ai_sessions')
      .update(patch)
      .eq('id', chatId)
      .eq('project_id', projectId)
      .select(FULL_SELECT)
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  })

  return { chat: data, dbMs: ms }
}

export async function deleteAiChat(
  projectId: string,
  userId: string,
  chatId: string,
): Promise<{ dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const { ms } = await timed('ai_chats.delete', async () => {
    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('ai_sessions')
      .delete()
      .eq('id', chatId)
      .eq('project_id', projectId)

    if (error) throw new Error(error.message)
  })

  return { dbMs: ms }
}

/** @deprecated Используйте createAiChat / updateAiChat */
export async function saveAiSession(
  projectId: string,
  userId: string,
  mode: string,
  messages: unknown,
): Promise<{ dbMs: number }> {
  const safeMessages = normalizeMessages(messages)
  if (safeMessages.length === 0) return { dbMs: 0 }

  const { dbMs } = await createAiChat(projectId, userId, {
    mode,
    messages: safeMessages,
    context_snapshot: null,
  })
  return { dbMs }
}
