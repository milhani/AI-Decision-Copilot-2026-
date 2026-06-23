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

/** Сообщения для сохранения в БД */
export function messagesForPersist(messages: AiMessage[]): AiMessage[] {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.streaming)
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content.trim(),
      ...(m.confidence ? { confidence: m.confidence } : {}),
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    }))
    .filter((m) => m.content.length > 0)
}
