import { Bot } from 'lucide-react'

interface ChatTypingIndicatorProps {
  label?: string
}

export function ChatTypingIndicator({ label = 'Печатает…' }: ChatTypingIndicatorProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-sm ring-1 ring-border">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  )
}
