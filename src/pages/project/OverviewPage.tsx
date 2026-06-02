import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { subDays } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import {
  aggregatePeriod,
  buildTimeSeries,
  comparePeriods,
  defaultDateRange,
  detectAnomalies,
  filterPostsByPeriod,
  periodLengthDays,
} from '@/lib/analytics'
import { formatNumber, formatPercent, formatDate } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updatePostNote } from '@/lib/posts-api'
import { toast } from 'sonner'
import type { PostWithMetrics } from '@/types/database'

export function OverviewPage() {
  const { id } = useParams<{ id: string }>()
  const { project, posts, loading, reload } = useProject(id)
  const [range, setRange] = useState(() => defaultDateRange(30))
  const [compare, setCompare] = useState(false)
  const [sortBy, setSortBy] = useState<'reach' | 'er'>('reach')
  const [selectedPost, setSelectedPost] = useState<PostWithMetrics | null>(null)
  const [note, setNote] = useState('')

  const periodPosts = useMemo(
    () => filterPostsByPeriod(posts, range.from, range.to),
    [posts, range],
  )

  const prevPeriod = useMemo(() => {
    const days = periodLengthDays(range.from, range.to)
    const prevTo = subDays(range.from, 1)
    const prevFrom = subDays(prevTo, days - 1)
    return filterPostsByPeriod(posts, prevFrom, prevTo)
  }, [posts, range])

  const metrics = useMemo(() => aggregatePeriod(periodPosts), [periodPosts])
  const prevMetrics = useMemo(() => aggregatePeriod(prevPeriod), [prevPeriod])
  const periodCompare = useMemo(
    () => (compare ? comparePeriods(metrics, prevMetrics) : []),
    [compare, metrics, prevMetrics],
  )
  const anomalies = useMemo(
    () => (compare ? detectAnomalies(periodPosts, prevPeriod) : []),
    [compare, periodPosts, prevPeriod],
  )

  const reachSeries = useMemo(() => buildTimeSeries(periodPosts, 'reach'), [periodPosts])
  const erSeries = useMemo(() => buildTimeSeries(periodPosts, 'er'), [periodPosts])

  const sortedPosts = useMemo(() => {
    return [...periodPosts].sort((a, b) => {
      const ma = a.post_metrics[0]
      const mb = b.post_metrics[0]
      const va = Number(sortBy === 'reach' ? ma?.reach : ma?.er) || 0
      const vb = Number(sortBy === 'reach' ? mb?.reach : mb?.er) || 0
      return vb - va
    })
  }, [periodPosts, sortBy])

  const saveNote = async () => {
    if (!selectedPost || !id) return
    try {
      await updatePostNote(id, selectedPost.id, note || null)
      toast.success('Заметка сохранена')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  if (loading) return <p className="text-muted-foreground">Загрузка…</p>

  if (!posts.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">Нет данных для аналитики</p>
          <p className="mt-2 text-muted-foreground">
            Импортируйте CSV/XLSX с метриками постов, чтобы увидеть графики и аномалии.
          </p>
          <Button className="mt-4" asChild>
            <Link to={`/projects/${id}/import`}>Перейти к импорту</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project?.name ?? 'Обзор'}</h1>
        <p className="text-muted-foreground">Аналитика и аномалии по периоду</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <Label>С</Label>
            <Input
              type="date"
              value={range.from.toISOString().slice(0, 10)}
              onChange={(e) =>
                setRange((r) => ({ ...r, from: new Date(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>По</Label>
            <Input
              type="date"
              value={range.to.toISOString().slice(0, 10)}
              onChange={(e) => setRange((r) => ({ ...r, to: new Date(e.target.value) }))}
            />
          </div>
          <Button
            variant={compare ? 'default' : 'outline'}
            onClick={() => setCompare(!compare)}
          >
            Сравнить с предыдущим периодом
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Средний охват</CardDescription>
            <CardTitle>{formatNumber(metrics.avgReach, 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Средний ER</CardDescription>
            <CardTitle>{formatPercent(metrics.avgEr)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Постов в периоде</CardDescription>
            <CardTitle>{metrics.postCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {compare && periodCompare.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Изменение vs предыдущий период</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {periodCompare.map((c) => (
              <Badge
                key={c.metric}
                variant={c.change >= 0 ? 'success' : 'destructive'}
              >
                {c.metric}: {c.change > 0 ? '+' : ''}
                {c.change.toFixed(1)}%
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {compare && anomalies.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Аномалии (&gt;20% к прошлому периоду)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{a.metric}</span>: {a.caption} —{' '}
                {a.direction === 'up' ? '↑' : '↓'} {Math.abs(a.changePercent)}% (
                {formatNumber(a.previous)} → {formatNumber(a.current)})
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Охват по времени</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reachSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ER по времени</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={erSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#16a34a" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Посты</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sortBy === 'reach' ? 'default' : 'outline'}
              onClick={() => setSortBy('reach')}
            >
              По охвату
            </Button>
            <Button
              size="sm"
              variant={sortBy === 'er' ? 'default' : 'outline'}
              onClick={() => setSortBy('er')}
            >
              По ER
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Дата</th>
                <th className="pb-2 pr-4">Текст</th>
                <th className="pb-2 pr-4">Охват</th>
                <th className="pb-2">ER</th>
              </tr>
            </thead>
            <tbody>
              {sortedPosts.map((p) => {
                const m = p.post_metrics[0]
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b hover:bg-muted/50"
                    onClick={() => {
                      setSelectedPost(p)
                      setNote(p.manual_note ?? '')
                    }}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatDate(p.published_at)}
                    </td>
                    <td className="max-w-xs truncate py-2 pr-4">
                      {p.caption_preview}
                    </td>
                    <td className="py-2 pr-4">{formatNumber(m?.reach, 0)}</td>
                    <td className="py-2">{formatPercent(m?.er)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedPost && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card p-6 shadow-xl">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedPost(null)}>
            Закрыть
          </Button>
          <h2 className="text-lg font-semibold">Детали поста</h2>
          <p className="mt-2 text-sm text-muted-foreground">{selectedPost.caption_preview}</p>
          <p className="text-sm">{formatDate(selectedPost.published_at)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {(['reach', 'impressions', 'er', 'likes', 'comments', 'clicks'] as const).map(
              (k) => (
                <div key={k} className="rounded bg-muted p-2">
                  <div className="text-xs text-muted-foreground uppercase">{k}</div>
                  <div className="font-medium">
                    {selectedPost.post_metrics[0]?.[k] ?? '—'}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="mt-4 space-y-2">
            <Label>Заметка аналитика</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
            <Button onClick={saveNote}>Сохранить заметку</Button>
          </div>
        </div>
      )}
    </div>
  )
}
