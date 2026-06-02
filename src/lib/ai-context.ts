import type { Hypothesis, PostWithMetrics } from '@/types/database'
import { aggregatePeriod, filterPostsByPeriod } from '@/lib/analytics'

export function buildAiContext(
  posts: PostWithMetrics[],
  hypotheses: Hypothesis[],
  from: Date,
  to: Date,
) {
  const periodPosts = filterPostsByPeriod(posts, from, to)
  const metrics = aggregatePeriod(periodPosts)

  const sortedByReach = [...periodPosts].sort(
    (a, b) => Number(b.post_metrics[0]?.reach ?? 0) - Number(a.post_metrics[0]?.reach ?? 0),
  )
  const top5 = sortedByReach.slice(0, 5).map(formatPost)
  const bottom5 = sortedByReach.slice(-5).reverse().map(formatPost)

  const activeHypotheses = hypotheses
    .filter((h) => ['draft', 'testing'].includes(h.status))
    .map((h) => ({
      title: h.title,
      status: h.status,
      kpi: h.kpi_name,
      baseline: h.baseline_value,
      target: h.target_value,
    }))

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    aggregated: metrics,
    topPosts: top5,
    bottomPosts: bottom5,
    activeHypotheses,
    hasData: periodPosts.length > 0,
  }
}

function formatPost(p: PostWithMetrics) {
  const m = p.post_metrics[0]
  return {
    date: p.published_at.slice(0, 10),
    caption: p.caption_preview?.slice(0, 80),
    reach: m?.reach,
    er: m?.er,
    likes: m?.likes,
    comments: m?.comments,
    clicks: m?.clicks,
  }
}
