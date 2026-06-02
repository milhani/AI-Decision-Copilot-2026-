import type { AiMessage } from '@/types/database'

export type ApiChatMessage = { role: 'user' | 'assistant'; content: string }

/** История для API: без стриминга, пустых и служебных полей */
export function historyForApi(messages: AiMessage[]): ApiChatMessage[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.streaming)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0)
}
