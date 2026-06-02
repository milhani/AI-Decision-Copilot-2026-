import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(digits)}K`
  return n.toFixed(digits)
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(2)}%`
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
