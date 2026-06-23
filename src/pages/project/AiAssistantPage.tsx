import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart3, MessageCircle, Send, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { subDays } from 'date-fns'
import { AiChatHistory } from '@/components/chat/AiChatHistory'
import { AiChatThread } from '@/components/chat/AiChatThread'
import { useProject } from '@/hooks/useProject'
import {
  createAiChat,
  deleteAiChat,
  getAiChat,
  listAiChats,
  readChatListCache,
  streamAiAssistant,
  updateAiChat,
  typewriterMock,
} from '@/lib/ai-api'
import { historyForApi, messagesForPersist } from '@/lib/ai-chat-utils'
import { buildAiContext } from '@/lib/ai-context'
import { useMockAi } from '@/lib/ai-config'
import { getMockAiResponse, mockAiDelay, type MockAiPayload } from '@/lib/mock-ai'
import { ANALYST_SCENARIOS } from '@/lib/constants'
import type { AiMessage, AiMode, AiSession } from '@/types/database'
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

function hydrateMessages(raw: AiMessage[]): AiMessage[] {
  return raw.map((m) => ({
    ...m,
    id: m.id ?? crypto.randomUUID(),
    confidence:
      m.confidence === 'низкая' || m.confidence === 'средняя' || m.confidence === 'высокая'
        ? m.confidence
        : undefined,
  }))
}

export function AiAssistantPage() {
  const mockMode = useMockAi()
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project, posts, hypotheses, loading: bundleLoading } = useProject(projectId)
  const [mode, setMode] = useState<AiMode>('chat')
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [chatList, setChatList] = useState<AiSession[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [waitingReply, setWaitingReply] = useState(false)
  const [coachStep, setCoachStep] = useState(0)
  const [coachInput, setCoachInput] = useState('')
  const [analystInput, setAnalystInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const persistInFlightRef = useRef<Promise<void> | null>(null)
  const activeChatIdRef = useRef<string | null>(null)
  const modeRef = useRef(mode)
  const persistChatRef = useRef<(msgs: AiMessage[]) => Promise<void>>(async () => {})

  modeRef.current = mode

  const hasData = posts.length > 0
  const isBusy = waitingReply || messages.some((m) => m.streaming)
  const context = buildAiContext(
    posts,
    hypotheses,
    subDays(new Date(), 30),
    new Date(),
    project,
  )

  const loadChatList = useCallback(async (refresh = false) => {
    if (!projectId) return

    const cached = !refresh ? readChatListCache(projectId, mode) : null
    if (cached) {
      setChatList(cached)
    }

    setChatsLoading(!cached)
    try {
      const list = await listAiChats(projectId, mode, refresh)
      setChatList(list)
    } catch (e) {
      if (!cached) {
        console.warn('[AiAssistant] chat list', e)
      }
    } finally {
      setChatsLoading(false)
    }
  }, [projectId, mode])

  useEffect(() => {
    void loadChatList()
  }, [loadChatList])

  const persistChat = useCallback(
    async (msgs: AiMessage[]) => {
      if (!projectId) return

      const stored = messagesForPersist(msgs)
      if (stored.length === 0) return

      const run = async () => {
        const currentMode = modeRef.current
        try {
          if (activeChatIdRef.current) {
            const chat = await updateAiChat(projectId, activeChatIdRef.current, {
              mode: currentMode,
              messages: stored,
            })
            setChatList((prev) => {
              const idx = prev.findIndex((c) => c.id === chat.id)
              if (idx === -1) return [chat, ...prev]
              const next = [...prev]
              next[idx] = chat
              return next
            })
          } else {
            const chat = await createAiChat(projectId, {
              mode: currentMode,
              messages: stored,
            })
            activeChatIdRef.current = chat.id
            setActiveChatId(chat.id)
            setChatList((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)])
          }
        } catch (e) {
          console.warn('[persistChat]', e)
          toast.error(e instanceof Error ? e.message : 'Не удалось сохранить диалог')
        }
      }

      if (persistInFlightRef.current) {
        await persistInFlightRef.current
      }

      const task = run()
      persistInFlightRef.current = task
      try {
        await task
      } finally {
        persistInFlightRef.current = null
      }
    },
    [projectId],
  )

  persistChatRef.current = persistChat

  const startNewChat = useCallback(() => {
    activeChatIdRef.current = null
    setActiveChatId(null)
    setMessages([])
    setCoachStep(0)
    setCoachInput('')
    setAnalystInput('')
    setChatInput('')
    setWaitingReply(false)
  }, [])

  const openChat = useCallback(
    async (chatId: string) => {
      if (!projectId || isBusy) return
      try {
        const chat = await getAiChat(projectId, chatId)
        if (chat.mode !== mode) {
          setMode(chat.mode)
        }
        activeChatIdRef.current = chat.id
        setActiveChatId(chat.id)
        setMessages(hydrateMessages(chat.messages))
        setCoachInput('')
        setAnalystInput('')
        setChatInput('')
        setCoachStep(
          chat.mode === 'coach' && chat.context_snapshot?.coachStep != null
            ? chat.context_snapshot.coachStep
            : 0,
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось открыть диалог')
      }
    },
    [isBusy, mode, projectId],
  )

  const removeChat = useCallback(
    async (chatId: string) => {
      if (!projectId) return
      if (!confirm('Удалить этот диалог?')) return
      try {
        await deleteAiChat(projectId, chatId, mode)
        if (activeChatIdRef.current === chatId) {
          startNewChat()
        }
        void loadChatList()
        toast.success('Диалог удалён')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка удаления')
      }
    },
    [loadChatList, projectId, startNewChat],
  )

  const switchMode = (nextMode: AiMode) => {
    setMode(nextMode)
    startNewChat()
  }

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
          : payload.mode === 'coach'
            ? 'Собираю рекомендации по вашим ответам…'
            : 'Думаю…'

      setMessages([
        ...history,
        newMessage('assistant', '', {
          id: assistantId,
          streaming: true,
          pendingLabel,
        }),
      ])
      setWaitingReply(true)

      let confidence: AiMessage['confidence'] | undefined =
        payload.mode === 'chat' ? undefined : 'средняя'
      let fullContent = ''

      const apiMessages = historyForApi(history)
      const mockHasData = payload.mode === 'chat' ? context.hasData : hasData

      try {
        if (mockMode) {
          await mockAiDelay(200)
          const mock = getMockAiResponse({ ...payload, messages: apiMessages }, mockHasData)
          if (payload.mode !== 'chat') confidence = mock.confidence
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
            if (payload.mode !== 'chat') {
              confidence = (result.confidence as AiMessage['confidence']) ?? 'средняя'
            }
          } catch (aiErr) {
            const err = aiErr instanceof Error ? aiErr.message : 'Ошибка AI'
            if (err.includes('DEEPSEEK_API_KEY') || err.includes('OPENAI_API_KEY')) {
              toast.info('LLM не настроен — демо-ответ')
              const mock = getMockAiResponse({ ...payload, messages: apiMessages }, mockHasData)
              if (payload.mode !== 'chat') confidence = mock.confidence
              await typewriterMock(mock.content, (chunk) => appendDelta(assistantId, chunk))
              fullContent = mock.content
            } else if (err.includes('fetch') || err.includes('Failed')) {
              toast.info('Сервер недоступен — демо-ответ')
              const mock = getMockAiResponse({ ...payload, messages: apiMessages }, mockHasData)
              if (payload.mode !== 'chat') confidence = mock.confidence
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
          ...(confidence ? { confidence } : {}),
          timestamp: now(),
          streaming: false,
        }

        setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalMsg : m)))
        const full = [...history, finalMsg]
        void persistChatRef.current(full)
        return full
      } finally {
        setWaitingReply(false)
      }
    },
    [appendDelta, context.hasData, hasData, mockMode, projectId],
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

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text || isBusy) return

    const userMsg = newMessage('user', text)
    const history = [...messages, userMsg]
    setMessages(history)
    setChatInput('')

    try {
      await streamAssistantReply(history, { mode: 'chat', context })
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
      const nextStep = coachStep + 1
      setCoachStep(nextStep)
      void persistChatRef.current(nextMessages)
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

  const handleAnalystKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy && analystInput.trim()) void sendAnalystFollowUp()
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy && chatInput.trim()) void sendChatMessage()
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

  const showBundleSkeleton = bundleLoading && posts.length === 0 && mode !== 'chat'

  const activeChat = chatList.find((c) => c.id === activeChatId)

  const modeTitle =
    mode === 'analyst' ? 'AI-аналитик' : mode === 'coach' ? 'AI-коуч' : 'Свободный чат'

  const modeSubtitle =
    mode === 'analyst'
      ? activeChat?.title ?? 'Ответ появляется по мере генерации'
      : mode === 'coach'
        ? activeChat?.title ?? `Шаг ${coachStep + 1} из ${COACH_STEPS.length}`
        : activeChat?.title ?? 'Диалог с контекстом проекта'

  const emptyTitle =
    mode === 'analyst'
      ? 'Задайте вопрос данным'
      : mode === 'coach'
        ? 'Диалог с коучем'
        : 'Начните разговор'

  const emptyHint =
    mode === 'analyst'
      ? 'Выберите сценарий — ответ будет печататься в чате'
      : mode === 'coach'
        ? 'Отвечайте на вопросы, в конце — рекомендации'
        : 'Спросите о метриках, стратегии, гипотезах или целях проекта'

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI-ассистент</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Аналитика, коучинг и свободный диалог
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
            variant={mode === 'chat' ? 'default' : 'outline'}
            className="flex-1 justify-start gap-2 lg:flex-none"
            onClick={() => switchMode('chat')}
          >
            <MessageCircle className="h-4 w-4" />
            Чат
          </Button>
          <Button
            variant={mode === 'analyst' ? 'default' : 'outline'}
            className="flex-1 justify-start gap-2 lg:flex-none"
            onClick={() => switchMode('analyst')}
          >
            <BarChart3 className="h-4 w-4" />
            Аналитик
          </Button>
          <Button
            variant={mode === 'coach' ? 'default' : 'outline'}
            className="flex-1 justify-start gap-2 lg:flex-none"
            onClick={() => switchMode('coach')}
          >
            <UserRound className="h-4 w-4" />
            Коуч
          </Button>
        </div>

        <div className="flex max-h-48 min-h-0 flex-1 flex-col border-t border-border/80 pt-3 lg:max-h-none">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            История
          </p>
          <AiChatHistory
            chats={chatList}
            activeChatId={activeChatId}
            loading={chatsLoading}
            onNewChat={startNewChat}
            onSelect={(id) => void openChat(id)}
            onDelete={(id) => void removeChat(id)}
          />
        </div>

        {mode === 'chat' && project && (
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground lg:mt-auto">
            <p className="font-medium text-foreground">{project.name}</p>
            {project.channels.length > 0 && (
              <p className="mt-1">Каналы: {project.channels.join(', ')}</p>
            )}
            {project.optional_goal_text && (
              <p className="mt-1 line-clamp-3">Цель: {project.optional_goal_text}</p>
            )}
            <p className="mt-2">
              {context.hasData
                ? `${context.aggregated.postCount} постов · ER ${context.aggregated.avgEr.toFixed(1)}%`
                : 'Метрики не импортированы'}
            </p>
          </div>
        )}

        {!hasData && !showBundleSkeleton && mode !== 'chat' && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            Импортируйте CSV, чтобы AI опирался на реальные метрики.
          </p>
        )}
      </aside>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md">
        <header className="flex shrink-0 items-center justify-between border-b border-border/80 bg-muted/20 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate font-medium">{modeTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{modeSubtitle}</p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              disabled={isBusy}
              onClick={startNewChat}
            >
              Новый диалог
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
            emptyTitle={emptyTitle}
            emptyHint={emptyHint}
            onCopy={copyMarkdown}
            onCreateHypothesis={createHypothesisFromMessage}
            showHypothesisAction={mode === 'analyst'}
          />
        )}

        <footer className="shrink-0 border-t border-border/80 bg-muted/30 p-4 backdrop-blur-sm">
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
          ) : mode === 'coach' ? (
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
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Напишите сообщение… (Enter — отправить, Shift+Enter — новая строка)"
                rows={2}
                className="min-h-[52px] resize-none bg-background"
                disabled={isBusy || showBundleSkeleton}
              />
              <Button
                size="icon"
                className="h-[52px] w-[52px] shrink-0"
                disabled={!chatInput.trim() || isBusy || showBundleSkeleton}
                onClick={() => void sendChatMessage()}
                aria-label="Отправить"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </footer>
      </section>
    </div>
  )
}
