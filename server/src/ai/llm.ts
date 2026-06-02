const SYSTEM_PROMPT = `You are an SMM analytics copilot. Rules:
1) Only reference metrics and posts provided in context JSON.
2) If data is missing, say so and ask to import CSV.
3) Propose testable hypotheses, not final decisions.
4) Never output a full monthly content strategy.
5) End every analysis with section: 'На чём основан вывод' with specific posts and numbers.
6) Add confidence: низкая/средняя/высокая.
Respond in Russian.`

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type AiChatRequest = {
  mode: 'analyst' | 'coach'
  scenario?: string
  messages?: ChatMessage[]
  context?: unknown
  coachStep?: number
  followUpText?: string
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; content: string; confidence: 'низкая' | 'средняя' | 'высокая' }
  | { type: 'error'; error: string }

const LLM_TIMEOUT_MS = 120_000
const MAX_HISTORY_MESSAGES = 24
const MAX_MESSAGE_CHARS = 14_000

type LlmConfig = {
  apiKey: string
  baseUrl: string
  model: string
  chatUrl: string
}

function getLlmConfig(): LlmConfig {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const provider =
    process.env.AI_PROVIDER?.trim().toLowerCase() ?? (deepseekKey ? 'deepseek' : 'openai')

  if (provider === 'deepseek') {
    if (!deepseekKey) throw new Error('DEEPSEEK_API_KEY не настроен в server/.env')
    const baseUrl = (process.env.AI_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
    return {
      apiKey: deepseekKey,
      baseUrl,
      model: process.env.AI_MODEL ?? 'deepseek-v4-flash',
      chatUrl: `${baseUrl}/chat/completions`,
    }
  }

  if (!openaiKey) throw new Error('OPENAI_API_KEY не настроен в server/.env')
  const baseUrl = (process.env.AI_BASE_URL ?? 'https://api.openai.com').replace(/\/$/, '')
  return {
    apiKey: openaiKey,
    baseUrl,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    chatUrl: `${baseUrl}/v1/chat/completions`,
  }
}

function trimContent(text: string): string {
  const t = text.trim()
  if (t.length <= MAX_MESSAGE_CHARS) return t
  return `${t.slice(0, MAX_MESSAGE_CHARS)}\n…[обрезано]`
}

export function toLlmHistory(raw?: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((m) => {
      const role = (m as ChatMessage).role
      return role === 'user' || role === 'assistant'
    })
    .map((m) => ({
      role: (m as ChatMessage).role as 'user' | 'assistant',
      content: trimContent(String((m as ChatMessage).content ?? '')),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
}

function hasAssistantReply(history: ChatMessage[]): boolean {
  return history.some((m) => m.role === 'assistant')
}

const ANALYST_SCENARIO_PROMPTS: Record<string, string> = {
  er_drop:
    'Объясни возможные причины падения ER за выбранный период. Предложи 3–5 проверяемых гипотез.',
  anomalies:
    'Найди аномалии в метриках и предложи 3–5 проверяемых гипотез с причинами.',
  top_posts:
    'Какие посты сработали лучше всего? Предложи 3–5 гипотез, почему они выиграли.',
}

function contextJson(body: AiChatRequest): string {
  try {
    return JSON.stringify(body.context ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function compactContextHint(body: AiChatRequest): string {
  const ctx = body.context as { aggregated?: { postCount?: number; avgEr?: number }; hasData?: boolean } | undefined
  const n = ctx?.aggregated?.postCount
  const er = ctx?.aggregated?.avgEr
  if (n == null) return 'Контекст метрик тот же, что в начале диалога.'
  return `Контекст метрик: ${n} постов, ср. ER ${typeof er === 'number' ? er.toFixed(2) : '—'}%.`
}

function buildAnalystUserContent(body: AiChatRequest, history: ChatMessage[], lastUserText: string): string {
  const scenarioPrompt =
    ANALYST_SCENARIO_PROMPTS[body.scenario ?? ''] ?? ANALYST_SCENARIO_PROMPTS.er_drop

  if (!hasAssistantReply(history)) {
    return `${scenarioPrompt}\n\nЗапрос пользователя: ${lastUserText}\n\nКонтекст метрик:\n${contextJson(body)}`
  }

  return `${scenarioPrompt}\n\nНовый запрос: ${lastUserText}\n\n${compactContextHint(body)}\n\nУчти предыдущие ответы в диалоге.`
}

function buildCoachSummaryUserContent(body: AiChatRequest): string {
  return `По всем ответам пользователя в истории выше сформируй структурированные рекомендации (2–3 направления для гипотез, без контент-плана на месяц).

Контекст метрик:
${contextJson(body)}`
}

/** Собирает messages для LLM без дублирования истории в JSON */
export function buildChatMessages(body: AiChatRequest): ChatMessage[] {
  const history = toLlmHistory(body.messages)
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

  const last = history[history.length - 1]

  if (body.mode === 'analyst') {
    if (last?.role === 'user') {
      messages[messages.length - 1] = {
        role: 'user',
        content: buildAnalystUserContent(body, history.slice(0, -1), last.content),
      }
      return messages
    }

    if (body.followUpText?.trim()) {
      messages.push({
        role: 'user',
        content: trimContent(body.followUpText),
      })
    }
    return messages
  }

  // coach
  if (!hasAssistantReply(history)) {
    if (last?.role === 'user') {
      messages.push({ role: 'user', content: buildCoachSummaryUserContent(body) })
    }
    return messages
  }

  // Продолжение после рекомендаций — последнее сообщение пользователя уже в history
  if (last?.role === 'user') {
    return messages
  }

  if (body.followUpText?.trim()) {
    messages.push({ role: 'user', content: trimContent(body.followUpText) })
  }

  return messages
}

export function parseConfidence(content: string): 'низкая' | 'средняя' | 'высокая' {
  const m = content.match(/уверенност[ьи]?:\s*(низкая|средняя|высокая)/i)
  const v = m?.[1]?.toLowerCase()
  if (v === 'низкая' || v === 'высокая' || v === 'средняя') return v
  return 'средняя'
}

function parseSseLines(buffer: string): { lines: string[]; rest: string } {
  const lines = buffer.split('\n')
  const rest = lines.pop() ?? ''
  return { lines, rest }
}

function extractDelta(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const data = trimmed.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const json = JSON.parse(data) as {
      choices?: { delta?: { content?: string } }[]
    }
    const piece = json.choices?.[0]?.delta?.content
    return piece ?? null
  } catch {
    return null
  }
}

export async function* streamAiChat(body: AiChatRequest): AsyncGenerator<StreamEvent> {
  const { apiKey, model, chatUrl } = getLlmConfig()
  const chatMessages = buildChatMessages(body)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: 0.4,
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timeout)
    const msg = e instanceof Error && e.name === 'AbortError' ? 'Таймаут ответа LLM' : String(e)
    yield { type: 'error', error: msg }
    return
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    let message = `LLM HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: { message?: string } }
      message = err.error?.message ?? message
    } catch {
      // ignore
    }
    yield { type: 'error', error: message }
    return
  }

  if (!res.body) {
    yield { type: 'error', error: 'Пустой ответ от LLM' }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { lines, rest } = parseSseLines(buffer)
      buffer = rest

      for (const line of lines) {
        const piece = extractDelta(line)
        if (!piece) continue
        full += piece
        yield { type: 'delta', text: piece }
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const piece = extractDelta(line)
        if (!piece) continue
        full += piece
        yield { type: 'delta', text: piece }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield {
    type: 'done',
    content: full || 'Не удалось получить ответ.',
    confidence: parseConfidence(full),
  }
}

/** Нестриминговый fallback */
export async function runAiChat(
  body: AiChatRequest,
): Promise<{ content: string; confidence: 'низкая' | 'средняя' | 'высокая' }> {
  let content = ''
  let confidence: 'низкая' | 'средняя' | 'высокая' = 'средняя'

  for await (const event of streamAiChat(body)) {
    if (event.type === 'delta') content += event.text
    if (event.type === 'done') {
      content = event.content
      confidence = event.confidence
    }
    if (event.type === 'error') throw new Error(event.error)
  }

  return { content, confidence }
}
