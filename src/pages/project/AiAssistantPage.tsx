import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart3, Send, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { subDays } from 'date-fns'
import { AiChatThread } from '@/components/chat/AiChatThread'
import { useProject } from '@/hooks/useProject'
import {
  saveAiSession,
  streamAiAssistant,
  typewriterMock,
} from '@/lib/ai-api'
import { historyForApi } from '@/lib/ai-chat-utils'
import { buildAiContext } from '@/lib/ai-context'
import { useMockAi } from '@/lib/ai-config'
import { getMockAiResponse, mockAiDelay, type MockAiPayload } from '@/lib/mock-ai'
import { ANALYST_SCENARIOS } from '@/lib/constants'
import type { AiMessage } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const COACH_STEPS = [
  'Опишите бизнес-контекст: ниша, продукт, аудитория.',
  'Какая метрика вас сейчас беспокоит больше всего?',
  'Что вы пробовали в последние 2–4 недели?',
  'Какие ограничения есть (бренд, ресурсы, бюджет)?',
  'Выберите направление: охват / лиды / сообщество — что приоритетнее сейчас?',
]

function now(): string {
  return new Date().toISOString()
}

function newMessage(
  role: AiMessage['role'],
  content: string,
  extra?: Partial<AiMessage>,
): AiMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: now(),
    ...extra,
  }
}

export function AiAssistantPage() {
  const mockMode = useMockAi()
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { posts, hypotheses, loading: bundleLoading } = useProject(projectId)
  const [mode, setMode] = useState<'analyst' | 'coach'>('analyst')
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [waitingReply, setWaitingReply] = useState(false)
  const [coachStep, setCoachStep] = useState(0)
  const [coachInput, setCoachInput] = useState('')
  const [analystInput, setAnalystInput] = useState('')
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasData = posts.length > 0
  const isBusy = waitingReply || messages.some((m) => m.streaming)
  const context = buildAiContext(
    posts,
    hypotheses,
    subDays(new Date(), 30),
    new Date(),
  )

  const schedulePersist = useCallback(
    (msgs: AiMessage[]) => {
      if (!projectId) return
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        saveAiSession(projectId, mode, msgs).catch(() => {})
      }, 600)
    },
    [projectId, mode],
  )

  const appendDelta = useCallback((assistantId: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + text } : m,
      ),
    )
  }, [])

  const streamAssistantReply = useCallback(
    async (history: AiMessage[], payload: MockAiPayload): Promise<AiMessage[]> => {
      const assistantId = crypto.randomUUID()
      const pendingLabel =
        payload.mode === 'analyst'
          ? 'Смотрю метрики и готовлю выводы…'
          : 'Собираю рекомендации по вашим ответам…'

      setMessages([
        ...history,
        newMessage('assistant', '', {
          id: assistantId,
          streaming: true,
          pendingLabel,
        }),
      ])
      setWaitingReply(true)

      let confidence: AiMessage['confidence'] = 'средняя'
      let fullContent = ''

      const apiMessages = historyForApi(history)

      try {
        if (mockMode) {
          await mockAiDelay(200)
          const mock = getMockAiResponse({ ...payload, messages: apiMessages }, hasData)
          confidence = mock.confidence
          await typewriterMock(mock.content, (chunk) => {
            fullContent += chunk
            appendDelta(assistantId, chunk)
          })
          fullContent = mock.content
        } else {
          try {
            const result = await streamAiAssistant(
              projectId!,
              { ...payload, messages: apiMessages },
              {
                onDelta: (chunk) => {
                  fullContent += chunk
                  appendDelta(assistantId, chunk)
                },
              },
            )
            fullContent = result.content
            confidence = (result.confidence as AiMessage['confidence']) ?? 'средняя'
          } catch (aiErr) {
            const err = aiErr instanceof Error ? aiErr.message : 'Ошибка AI'
            if (err.includes('DEEPSEEK_API_KEY') || err.includes('OPENAI_API_KEY')) {
              toast.info('LLM не настроен — демо-ответ')
              const mock = getMockAiResponse({ ...payload, messages: apiMessages }, hasData)
              confidence = mock.confidence
              await typewriterMock(mock.content, (chunk) => appendDelta(assistantId, chunk))
              fullContent = mock.content
            } else if (err.includes('fetch') || err.includes('Failed')) {
              toast.info('Сервер недоступен — демо-ответ')
              const mock = getMockAiResponse({ ...payload, messages: apiMessages }, hasData)
              confidence = mock.confidence
              await typewriterMock(mock.content, (chunk) => appendDelta(assistantId, chunk))
              fullContent = mock.content
            } else {
              throw aiErr
            }
          }
        }

        const finalMsg: AiMessage = {
          id: assistantId,
          role: 'assistant',
          content: fullContent,
          confidence,
          timestamp: now(),
          streaming: false,
        }

        setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalMsg : m)))
        const full = [...history, finalMsg]
        schedulePersist(full)
        return full
      } finally {
        setWaitingReply(false)
      }
    },
    [appendDelta, hasData, mockMode, projectId, schedulePersist],
  )

  const runAnalyst = async (scenarioId: string) => {
    if (!hasData) {
      toast.error('Сначала импортируйте CSV с данными')
      return
    }

    const scenario = ANALYST_SCENARIOS.find((s) => s.id === scenarioId)
    const userMsg = newMessage('user', scenario?.label ?? scenarioId)
    const history = [...messages, userMsg]
    setMessages(history)

    try {
      await streamAssistantReply(history, {
        mode: 'analyst',
        scenario: scenarioId,
        context,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const sendAnalystFollowUp = async () => {
    const text = analystInput.trim()
    if (!text || !hasData) return

    const userMsg = newMessage('user', text)
    const history = [...messages, userMsg]
    setMessages(history)
    setAnalystInput('')

    try {
      await streamAssistantReply(history, {
        mode: 'analyst',
        scenario: 'er_drop',
        context,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const runCoachStep = async () => {
    if (!coachInput.trim()) return

    const userMsg = newMessage('user', coachInput.trim())
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setCoachInput('')

    const isLast = coachStep >= COACH_STEPS.length - 1

    if (!isLast) {
      setCoachStep((s) => s + 1)
      return
    }

    try {
      await streamAssistantReply(nextMessages, {
        mode: 'coach',
        coachStep: coachStep + 1,
        context,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const resetChat = (nextMode: 'analyst' | 'coach') => {
    setMode(nextMode)
    setMessages([])
    setCoachStep(0)
    setCoachInput('')
    setAnalystInput('')
    setWaitingReply(false)
  }

  const handleAnalystKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy && analystInput.trim()) void sendAnalystFollowUp()
    }
  }

  const copyMarkdown = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Скопировано')
  }

  const createHypothesisFromMessage = (content: string) => {
    const firstLine = content.split('\n').find((l) => l.match(/^\d\./)) ?? ''
    navigate(`/projects/${projectId}/hypotheses/new`, {
      state: {
        prefill: {
          title: firstLine.replace(/^\d\.\s*/, '').slice(0, 120) || 'Гипотеза из AI',
          description: content.slice(0, 500),
        },
      },
    })
  }

  const handleCoachKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy && coachInput.trim()) void runCoachStep()
    }
  }

  const showBundleSkeleton = bundleLoading && posts.length === 0

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-56">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI-ассистент</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Аналитика и коучинг по вашим метрикам
          </p>
        </div>

        {mockMode && (
          <Badge variant="secondary" className="w-fit gap-1">
            <Sparkles className="h-3 w-3" />
            Демо-режим
          </Badge>
        )}

        <div className="flex gap-2 lg:flex-col">
          <Button
            variant={mode === 'analyst' ? 'default' : 'outline'}
            className="flex-1 justify-start gap-2 lg:flex-none"
            onClick={() => resetChat('analyst')}
          >
            <BarChart3 className="h-4 w-4" />
            Аналитик
          </Button>
          <Button
            variant={mode === 'coach' ? 'default' : 'outline'}
            className="flex-1 justify-start gap-2 lg:flex-none"
            onClick={() => resetChat('coach')}
          >
            <UserRound className="h-4 w-4" />
            Коуч
          </Button>
        </div>

        {!hasData && !showBundleSkeleton && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            Импортируйте CSV, чтобы AI опирался на реальные метрики.
          </p>
        )}
      </aside>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-medium">
              {mode === 'analyst' ? 'AI-аналитик' : 'AI-коуч'}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === 'analyst'
                ? 'Ответ появляется по мере генерации'
                : `Шаг ${coachStep + 1} из ${COACH_STEPS.length}`}
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={isBusy}
              onClick={() => resetChat(mode)}
            >
              Очистить чат
            </Button>
          )}
        </header>

        {showBundleSkeleton ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-muted" />
            <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : (
          <AiChatThread
            messages={messages}
            loading={waitingReply}
            loadingLabel={mockMode ? 'Готовим ответ…' : 'Подключаемся к модели…'}
            emptyTitle={mode === 'analyst' ? 'Задайте вопрос данным' : 'Диалог с коучем'}
            emptyHint={
              mode === 'analyst'
                ? 'Выберите сценарий — ответ будет печататься в чате'
                : 'Отвечайте на вопросы, в конце — рекомендации'
            }
            onCopy={copyMarkdown}
            onCreateHypothesis={createHypothesisFromMessage}
            showHypothesisAction={mode === 'analyst'}
          />
        )}

        <footer className="shrink-0 border-t border-border bg-muted/30 p-4">
          {mode === 'analyst' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {ANALYST_SCENARIOS.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    disabled={isBusy || !hasData || showBundleSkeleton}
                    className={cn(
                      'rounded-full bg-background transition-colors',
                      !hasData && 'opacity-50',
                    )}
                    onClick={() => runAnalyst(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              {messages.some((m) => m.role === 'assistant') && (
                <div className="flex gap-2">
                  <Textarea
                    value={analystInput}
                    onChange={(e) => setAnalystInput(e.target.value)}
                    onKeyDown={handleAnalystKeyDown}
                    placeholder="Уточняющий вопрос по ответу… (Enter — отправить)"
                    rows={2}
                    className="min-h-[52px] resize-none bg-background"
                    disabled={isBusy || !hasData || showBundleSkeleton}
                  />
                  <Button
                    size="icon"
                    className="h-[52px] w-[52px] shrink-0"
                    disabled={!analystInput.trim() || isBusy || showBundleSkeleton}
                    onClick={() => void sendAnalystFollowUp()}
                    aria-label="Отправить"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium leading-snug text-foreground">
                {COACH_STEPS[coachStep]}
              </p>
              <div className="flex gap-2">
                <Textarea
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyDown={handleCoachKeyDown}
                  placeholder="Ваш ответ… (Enter — отправить, Shift+Enter — новая строка)"
                  rows={2}
                  className="min-h-[52px] resize-none bg-background"
                  disabled={isBusy || showBundleSkeleton}
                />
                <Button
                  size="icon"
                  className="h-[52px] w-[52px] shrink-0"
                  disabled={!coachInput.trim() || isBusy || showBundleSkeleton}
                  onClick={() => void runCoachStep()}
                  aria-label="Отправить"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </footer>
      </section>
    </div>
  )
}
