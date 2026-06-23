import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center page-enter',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-glow">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
