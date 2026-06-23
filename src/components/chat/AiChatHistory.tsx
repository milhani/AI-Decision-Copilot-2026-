import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { MessageSquarePlus, Trash2 } from 'lucide-react'
import type { AiSession } from '@/types/database'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AiChatHistoryProps {
  chats: AiSession[]
  activeChatId: string | null
  loading?: boolean
  onNewChat: () => void
  onSelect: (chatId: string) => void
  onDelete: (chatId: string) => void
}

export function AiChatHistory({
  chats,
  activeChatId,
  loading,
  onNewChat,
  onSelect,
  onDelete,
}: AiChatHistoryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 bg-background"
        onClick={onNewChat}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Новый диалог
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">Загрузка…</p>
        ) : chats.length === 0 ? (
          <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
            Сохранённые диалоги появятся здесь
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId
              const preview =
                chat.title ||
                chat.messages.find((m) => m.role === 'user')?.content?.slice(0, 48) ||
                'Диалог'
              const dateLabel = format(new Date(chat.updated_at), 'd MMM, HH:mm', { locale: ru })

              return (
                <li key={chat.id}>
                  <div
                    className={cn(
                      'group flex items-start gap-1 rounded-xl border border-transparent transition-colors',
                      isActive && 'border-primary/20 bg-primary/5',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(chat.id)}
                      className={cn(
                        'min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/80',
                        isActive && 'hover:bg-primary/5',
                      )}
                    >
                      <p
                        className={cn(
                          'line-clamp-2 text-xs font-medium leading-snug',
                          isActive ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {preview}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{dateLabel}</p>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mt-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(chat.id)
                      }}
                      aria-label="Удалить диалог"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
