import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { ChatTypingIndicator } from '@/components/chat/ChatTypingIndicator'
import type { AiMessage } from '@/types/database'

const STICK_THRESHOLD_PX = 120

interface AiChatThreadProps {
  messages: AiMessage[]
  loading?: boolean
  loadingLabel?: string
  emptyTitle?: string
  emptyHint?: string
  onCopy?: (text: string) => void
  onCreateHypothesis?: (text: string) => void
  showHypothesisAction?: boolean
}

function scrollToBottom(el: HTMLElement) {
  el.scrollTop = el.scrollHeight
}

export function AiChatThread({
  messages,
  loading = false,
  loadingLabel,
  emptyTitle = 'Начните диалог',
  emptyHint = 'Выберите сценарий или ответьте на вопрос коуча',
  onCopy,
  onCreateHypothesis,
  showHypothesisAction = false,
}: AiChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const wasStreamingRef = useRef(false)

  const isStreaming = messages.some((m) => m.streaming)

  const scrollSignature = messages
    .map((m) => `${m.id}:${m.content.length}`)
    .join('|')

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distance < STICK_THRESHOLD_PX
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last.role === 'user') stickToBottomRef.current = true
    }
  }, [messages.length, messages[messages.length - 1]?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !stickToBottomRef.current) return

    requestAnimationFrame(() => {
      scrollToBottom(el)
    })
  }, [scrollSignature, loading])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isStreaming) {
      wasStreamingRef.current = true
      return
    }

    if (!wasStreamingRef.current) return
    wasStreamingRef.current = false

    if (!stickToBottomRef.current) return

    requestAnimationFrame(() => {
      scrollToBottom(el)
      requestAnimationFrame(() => scrollToBottom(el))
    })
  }, [isStreaming])

  const isEmpty = messages.length === 0 && !loading && !isStreaming
  const showTyping = loading && !isStreaming

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-1 py-4"
      >
        {isEmpty && (
          <div className="flex min-h-[min(280px,40vh)] flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium">{emptyTitle}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id ?? `${msg.timestamp}-${msg.role}`}
            message={msg}
            onCopy={msg.streaming ? undefined : onCopy}
            onCreateHypothesis={msg.streaming ? undefined : onCreateHypothesis}
            showHypothesisAction={showHypothesisAction && !msg.streaming}
          />
        ))}

        {showTyping && <ChatTypingIndicator label={loadingLabel} />}
      </div>
    </div>
  )
}
