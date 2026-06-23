import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { differenceInDays, parseISO } from 'date-fns'
import { Plus, BookOpen, FlaskConical } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { HYPOTHESIS_STATUS_LABELS, ER_CHECKLIST } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import type { Hypothesis, HypothesisStatus } from '@/types/database'
import { PageHeader } from '@/components/ui/page-header'
import { PageSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export function HypothesesPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') ?? 'active'
  const { hypotheses, loading } = useProject(id)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState('__all__')
  const [kbSearch, setKbSearch] = useState('')

  const allTags = useMemo(
    () => [...new Set(hypotheses.flatMap((h) => h.tags))],
    [hypotheses],
  )

  const filtered = useMemo(() => {
    let list = hypotheses
    if (view === 'knowledge') {
      list = list.filter((h) =>
        ['confirmed', 'rejected', 'postponed'].includes(h.status),
      )
      if (kbSearch) {
        const q = kbSearch.toLowerCase()
        list = list.filter(
          (h) =>
            h.title.toLowerCase().includes(q) ||
            (h.result_summary?.toLowerCase().includes(q) ?? false),
        )
      }
    } else {
      if (statusFilter !== 'all') {
        list = list.filter((h) => h.status === statusFilter)
      }
      if (tagFilter && tagFilter !== '__all__') {
        list = list.filter((h) => h.tags.includes(tagFilter))
      }
    }
    return list
  }, [hypotheses, view, statusFilter, tagFilter, kbSearch])

  const staleTesting = hypotheses.filter((h) => {
    if (h.status !== 'testing') return false
    return differenceInDays(new Date(), parseISO(h.created_at)) > 14
  })

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-8">
      <PageHeader
        title="Гипотезы"
        description="Реестр экспериментов и база знаний"
        icon={FlaskConical}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${id}/hypotheses/templates`}>
              <BookOpen className="mr-2 h-4 w-4" />
              Шаблоны
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/projects/${id}/hypotheses/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Новая гипотеза
            </Link>
          </Button>
        </div>
      </PageHeader>

      {staleTesting.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-amber-800">
              {staleTesting.length} гипотез(а) в статусе «Тестируется» более 14 дней —{' '}
              <strong>Закройте эксперимент</strong>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={view === 'active' ? 'default' : 'outline'}
          onClick={() => setSearchParams({})}
        >
          Активные
        </Button>
        <Button
          size="sm"
          variant={view === 'knowledge' ? 'default' : 'outline'}
          onClick={() => setSearchParams({ view: 'knowledge' })}
        >
          База знаний
        </Button>
      </div>

      {view === 'active' ? (
        <div className="flex flex-wrap gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {(Object.keys(HYPOTHESIS_STATUS_LABELS) as HypothesisStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {HYPOTHESIS_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Тег" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все теги</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Input
          placeholder="Поиск по названию и выводам…"
          value={kbSearch}
          onChange={(e) => setKbSearch(e.target.value)}
          className="max-w-md"
        />
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={FlaskConical}
              title={
                view === 'knowledge'
                  ? 'База знаний пуста'
                  : 'Пока нет гипотез'
              }
              description={
                view === 'knowledge'
                  ? 'Закрытые гипотезы появятся здесь после завершения экспериментов'
                  : 'Создайте первую гипотезу или выберите готовый шаблон'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <HypothesisCard key={h.id} hypothesis={h} projectId={id!} />
          ))}
        </div>
      )}

      {view === 'templates' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Падение ER — что проверить</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {ER_CHECKLIST.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function HypothesisCard({ hypothesis: h, projectId }: { hypothesis: Hypothesis; projectId: string }) {
  const stale =
    h.status === 'testing' && differenceInDays(new Date(), parseISO(h.created_at)) > 14

  return (
    <Card className="transition-all duration-200 hover:border-primary/15 hover:shadow-sm">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
        <div>
          <Link
            to={`/projects/${projectId}/hypotheses/${h.id}/edit`}
            className="font-medium hover:text-primary"
          >
            {h.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="secondary">{HYPOTHESIS_STATUS_LABELS[h.status]}</Badge>
            {h.kpi_name && <Badge variant="outline">KPI: {h.kpi_name}</Badge>}
            {h.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
            {stale && <Badge variant="warning">Закройте эксперимент</Badge>}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {h.deadline && <div>Дедлайн: {formatDate(h.deadline)}</div>}
          <div>Создана: {formatDate(h.created_at)}</div>
        </div>
      </CardContent>
    </Card>
  )
}
