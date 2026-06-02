import { differenceInDays, parseISO, subDays } from 'date-fns'
import type { PostWithMetrics } from '@/types/database'

export interface PeriodMetrics {
  avgReach: number
  avgEr: number
  totalReach: number
  postCount: number
}

export interface Anomaly {
  postId: string
  caption: string
  metric: string
  changePercent: number
  direction: 'up' | 'down'
  current: number
  previous: number
}

export function filterPostsByPeriod(
  posts: PostWithMetrics[],
  from: Date,
  to: Date,
): PostWithMetrics[] {
  return posts.filter((p) => {
    const d = parseISO(p.published_at)
    return d >= from && d <= to
  })
}

export function aggregatePeriod(posts: PostWithMetrics[]): PeriodMetrics {
  if (!posts.length) {
    return { avgReach: 0, avgEr: 0, totalReach: 0, postCount: 0 }
  }

  let reachSum = 0
  let erSum = 0
  let erCount = 0

  for (const p of posts) {
    const m = p.post_metrics[0]
    if (!m) continue
    reachSum += Number(m.reach ?? 0)
    if (m.er != null) {
      erSum += Number(m.er)
      erCount++
    }
  }

  return {
    avgReach: reachSum / posts.length,
    avgEr: erCount ? erSum / erCount : 0,
    totalReach: reachSum,
    postCount: posts.length,
  }
}

export function buildTimeSeries(
  posts: PostWithMetrics[],
  metric: 'reach' | 'er',
): { date: string; value: number }[] {
  const byDate = new Map<string, { sum: number; count: number }>()

  for (const p of posts) {
    const m = p.post_metrics[0]
    if (!m) continue
    const key = p.published_at.slice(0, 10)
    const val = Number(metric === 'reach' ? m.reach : m.er) || 0
    const prev = byDate.get(key) ?? { sum: 0, count: 0 }
    byDate.set(key, { sum: prev.sum + val, count: prev.count + 1 })
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      value: sum / count,
    }))
}

export function detectAnomalies(
  current: PostWithMetrics[],
  previous: PostWithMetrics[],
  threshold = 20,
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const prevMap = new Map(previous.map((p) => [p.id, p]))

  for (const post of current) {
    const prev = prevMap.get(post.id)
    if (!prev) continue
    const curM = post.post_metrics[0]
    const prevM = prev.post_metrics[0]
    if (!curM || !prevM) continue

    for (const [key, label] of [
      ['reach', 'Охват'],
      ['er', 'ER'],
    ] as const) {
      const cur = Number(curM[key] ?? 0)
      const prv = Number(prevM[key] ?? 0)
      if (prv === 0) continue
      const change = ((cur - prv) / prv) * 100
      if (Math.abs(change) >= threshold) {
        anomalies.push({
          postId: post.id,
          caption: post.caption_preview?.slice(0, 60) ?? 'Без текста',
          metric: label,
          changePercent: Math.round(change),
          direction: change > 0 ? 'up' : 'down',
          current: cur,
          previous: prv,
        })
      }
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
}

export function comparePeriods(
  current: PeriodMetrics,
  previous: PeriodMetrics,
): { metric: string; change: number }[] {
  const result: { metric: string; change: number }[] = []
  if (previous.avgReach > 0) {
    result.push({
      metric: 'Средний охват',
      change: ((current.avgReach - previous.avgReach) / previous.avgReach) * 100,
    })
  }
  if (previous.avgEr > 0) {
    result.push({
      metric: 'Средний ER',
      change: ((current.avgEr - previous.avgEr) / previous.avgEr) * 100,
    })
  }
  return result
}

export function defaultDateRange(days = 30): { from: Date; to: Date } {
  const to = new Date()
  const from = subDays(to, days)
  return { from, to }
}

export function periodLengthDays(from: Date, to: Date): number {
  return Math.max(1, differenceInDays(to, from) + 1)
}
