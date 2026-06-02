import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subDays } from 'date-fns'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useProject } from '@/hooks/useProject'
import {
  aggregatePeriod,
  defaultDateRange,
  detectAnomalies,
  filterPostsByPeriod,
  periodLengthDays,
} from '@/lib/analytics'
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/constants'
import { formatNumber, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const { project, posts, hypotheses, loading } = useProject(id)
  const [range, setRange] = useState(() => defaultDateRange(30))

  const periodPosts = useMemo(
    () => filterPostsByPeriod(posts, range.from, range.to),
    [posts, range],
  )

  const metrics = useMemo(() => aggregatePeriod(periodPosts), [periodPosts])

  const prevPeriod = useMemo(() => {
    const days = periodLengthDays(range.from, range.to)
    const prevTo = subDays(range.from, 1)
    const prevFrom = subDays(prevTo, days - 1)
    return filterPostsByPeriod(posts, prevFrom, prevTo)
  }, [posts, range])

  const anomalies = useMemo(
    () => detectAnomalies(periodPosts, prevPeriod).slice(0, 5),
    [periodPosts, prevPeriod],
  )

  const statusCounts = useMemo(() => {
    const counts = { testing: 0, confirmed: 0, rejected: 0 }
    for (const h of hypotheses) {
      if (h.status in counts) counts[h.status as keyof typeof counts]++
    }
    return counts
  }, [hypotheses])

  const markdown = useMemo(() => {
    const lines = [
      `# Отчёт за период: ${project?.name ?? 'Проект'}`,
      ``,
      `**Период:** ${range.from.toLocaleDateString('ru-RU')} — ${range.to.toLocaleDateString('ru-RU')}`,
      ``,
      `## Сводка метрик`,
      `- Средний охват: ${formatNumber(metrics.avgReach, 0)}`,
      `- Средний ER: ${formatPercent(metrics.avgEr)}`,
      `- Постов: ${metrics.postCount}`,
      ``,
      `## Топ аномалии`,
      ...(anomalies.length
        ? anomalies.map(
            (a) =>
              `- ${a.metric}: ${a.caption} (${a.changePercent > 0 ? '+' : ''}${a.changePercent}%)`,
          )
        : ['- Значимых аномалий не обнаружено']),
      ``,
      `## Гипотезы`,
      `- Тестируется: ${statusCounts.testing}`,
      `- Подтверждено: ${statusCounts.confirmed}`,
      `- Отклонено: ${statusCounts.rejected}`,
      ``,
      `---`,
      `_Сформировано AI Decision Copilot_`,
    ]
    return lines.join('\n')
  }, [project, range, metrics, anomalies, statusCounts])

  const copyReport = () => {
    navigator.clipboard.writeText(markdown)
    toast.success('Отчёт скопирован')
  }

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${id}-${range.from.toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Файл скачан')
  }

  if (loading) return <p className="text-muted-foreground">Загрузка…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Отчёт за период</h1>
          <p className="text-muted-foreground">Краткая сводка для клиента или команды</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyReport}>
            <Copy className="mr-2 h-4 w-4" />
            Скопировать
          </Button>
          <Button variant="outline" onClick={downloadMd}>
            <Download className="mr-2 h-4 w-4" />
            Скачать .md
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-4 pt-6">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Предпросмотр</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm">{markdown}</pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Средний охват
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatNumber(metrics.avgReach, 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Средний ER
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatPercent(metrics.avgEr)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Гипотезы
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {Object.entries(statusCounts).map(([k, v]) => (
              <div key={k}>
                {HYPOTHESIS_STATUS_LABELS[k]}: {v}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
