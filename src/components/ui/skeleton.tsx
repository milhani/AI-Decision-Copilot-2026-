import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-lg', className)}
      aria-hidden
      {...props}
    />
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 page-enter" aria-busy="true" aria-label="Загрузка">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  )
}
