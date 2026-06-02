import { memo } from 'react'
import { Bot, Copy, FlaskConical, User } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChatMarkdown } from '@/components/chat/ChatMarkdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AiMessage } from '@/types/database'
import { cn } from '@/lib/utils'

const CONFIDENCE_STYLES: Record<
  NonNullable<AiMessage['confidence']>,
  string
> = {
  низкая: 'border-amber-200 bg-amber-50 text-amber-800',
  средняя: 'border-sky-200 bg-sky-50 text-sky-800',
  высокая: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

interface ChatMessageBubbleProps {
  message: AiMessage
  onCopy?: (text: string) => void
  onCreateHypothesis?: (text: string) => void
  showHypothesisAction?: boolean
}

function ChatMessageBubbleInner({
  message,
  onCopy,
  onCreateHypothesis,
  showHypothesisAction = false,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const timeLabel = message.timestamp
    ? format(new Date(message.timestamp), 'HH:mm', { locale: ru })
    : null

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-border',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card text-primary',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'flex max-w-[min(100%,42rem)] flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div className="flex items-center gap-2 px-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? 'Вы' : 'AI Copilot'}
          </span>
          {timeLabel && (
            <span className="text-xs text-muted-foreground/70">{timeLabel}</span>
          )}
        </div>

        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm ring-1',
            isUser
              ? 'rounded-tr-md bg-primary text-primary-foreground ring-primary/20'
              : 'rounded-tl-md bg-card ring-border',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <>
              {message.confidence && !message.streaming && (
                <Badge
                  variant="outline"
                  className={cn(
                    'mb-2 border font-normal',
                    CONFIDENCE_STYLES[message.confidence],
                  )}
                >
                  Уверенность: {message.confidence}
                </Badge>
              )}
              {message.streaming && !message.content.trim() ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {message.pendingLabel ?? 'Готовлю ответ…'}
                </p>
              ) : (
                <div className="relative">
                  <ChatMarkdown content={message.content} />
                  {message.streaming && (
                    <span
                      className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
                      aria-hidden
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!isUser && (onCopy || (showHypothesisAction && onCreateHypothesis)) && (
          <div className="chat-message-actions mt-0.5 flex flex-wrap gap-1.5 px-0.5">
            {onCopy && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 border-0 text-xs shadow-none"
                onClick={() => onCopy(message.content)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Копировать
              </Button>
            )}
            {showHypothesisAction && onCreateHypothesis && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 border-0 text-xs shadow-none"
                onClick={() => onCreateHypothesis(message.content)}
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                В гипотезу
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ChatMessageBubble = memo(
  ChatMessageBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.role === next.message.role &&
    prev.message.confidence === next.message.confidence &&
    prev.message.streaming === next.message.streaming &&
    prev.message.pendingLabel === next.message.pendingLabel &&
    prev.showHypothesisAction === next.showHypothesisAction,
)
