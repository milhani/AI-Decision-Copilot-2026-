import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { assertProjectOwner } from './ownership.js'

type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  confidence?: string
  timestamp?: string
}

const MAX_STORED_MESSAGES = 50
const MAX_STORED_CONTENT = 50_000

function normalizeMode(mode: string): 'analyst' | 'coach' {
  if (mode === 'analyst' || mode === 'coach') return mode
  throw new Error(`Некорректный mode: ${mode}`)
}

function normalizeMessages(messages: unknown): StoredMessage[] {
  if (!Array.isArray(messages)) return []

  const rows = messages
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
      if (typeof m.confidence === 'string') row.confidence = m.confidence.slice(0, 32)
      if (typeof m.timestamp === 'string') row.timestamp = m.timestamp.slice(0, 64)
      return row
    })
    .filter((m): m is StoredMessage => m !== null)

  return rows.slice(-MAX_STORED_MESSAGES)
}

export async function saveAiSession(
  projectId: string,
  userId: string,
  mode: string,
  messages: unknown,
): Promise<{ dbMs: number }> {
  await assertProjectOwner(projectId, userId)

  const safeMode = normalizeMode(mode)
  const safeMessages = normalizeMessages(messages)

  if (safeMessages.length === 0) {
    return { dbMs: 0 }
  }

  const { ms } = await timed('ai_sessions.insert', async () => {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('ai_sessions').insert({
      project_id: projectId,
      mode: safeMode,
      messages: safeMessages,
    })
    if (error) throw new Error(error.message)
  })

  return { dbMs: ms }
}
