import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useProject } from '@/hooks/useProject'
import {
  createHypothesis,
  fetchHypothesis,
  updateHypothesis,
} from '@/lib/hypotheses-api'
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/constants'
import type { HypothesisStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CLOSED_STATUSES: HypothesisStatus[] = ['confirmed', 'rejected', 'postponed']

export function HypothesisFormPage() {
  const { id: projectId, hypothesisId } = useParams<{ id: string; hypothesisId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const isEdit = Boolean(hypothesisId) && location.pathname.includes('/edit')
  const { posts, reload } = useProject(projectId)

  const prefill = (location.state as { prefill?: Record<string, string> })?.prefill

  const [form, setForm] = useState({
    title: prefill?.title ?? '',
    description: prefill?.description ?? '',
    status: (prefill?.status as HypothesisStatus) ?? 'draft',
    kpi_name: prefill?.kpi_name ?? '',
    baseline_value: prefill?.baseline_value ?? '',
    target_value: prefill?.target_value ?? '',
    deadline: prefill?.deadline ?? '',
    tags: prefill?.tags ?? '',
    linked_post_ids: [] as string[],
    result_summary: '',
    actual_value: '',
  })
  const [showCloseFields, setShowCloseFields] = useState(false)

  useEffect(() => {
    if (!isEdit || !hypothesisId) return
    if (!projectId) return
    fetchHypothesis(projectId, hypothesisId)
      .then((data) => {
        setForm({
          title: data.title,
          description: data.description ?? '',
          status: data.status as HypothesisStatus,
          kpi_name: data.kpi_name ?? '',
          baseline_value: String(data.baseline_value ?? ''),
          target_value: String(data.target_value ?? ''),
          deadline: data.deadline?.slice(0, 10) ?? '',
          tags: data.tags.join(', '),
          linked_post_ids: data.linked_post_ids ?? [],
          result_summary: data.result_summary ?? '',
          actual_value: String(data.actual_value ?? ''),
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Ошибка загрузки'))
  }, [isEdit, hypothesisId, projectId])

  const autoFillActual = () => {
    if (!form.kpi_name || !form.linked_post_ids.length) return
    const post = posts.find((p) => form.linked_post_ids.includes(p.id))
    const m = post?.post_metrics[0]
    if (!m) return
    const val = m[form.kpi_name as keyof typeof m]
    if (val != null) setForm((f) => ({ ...f, actual_value: String(val) }))
  }

  const save = async () => {
    if (!projectId || !form.title.trim()) {
      toast.error('Укажите название гипотезы')
      return
    }

    if (CLOSED_STATUSES.includes(form.status) && !form.result_summary.trim()) {
      toast.error('При закрытии укажите итог (result_summary)')
      return
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      kpi_name: form.kpi_name || null,
      baseline_value: form.baseline_value ? Number(form.baseline_value) : null,
      target_value: form.target_value ? Number(form.target_value) : null,
      deadline: form.deadline || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      linked_post_ids: form.linked_post_ids,
      result_summary: form.result_summary.trim() || null,
      actual_value: form.actual_value ? Number(form.actual_value) : null,
      closed_at: CLOSED_STATUSES.includes(form.status) ? new Date().toISOString() : null,
    }

    try {
      if (isEdit && hypothesisId) {
        await updateHypothesis(projectId, hypothesisId, payload)
        toast.success('Гипотеза обновлена')
      } else {
        await createHypothesis(projectId, payload)
        toast.success('Гипотеза создана')
      }
      navigate(`/projects/${projectId}/hypotheses`)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">
        {isEdit ? 'Редактировать гипотезу' : 'Новая гипотеза'}
      </h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select
              value={form.status}
              onValueChange={(v) => {
                const status = v as HypothesisStatus
                setForm({ ...form, status })
                setShowCloseFields(CLOSED_STATUSES.includes(status))
                if (CLOSED_STATUSES.includes(status)) autoFillActual()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HYPOTHESIS_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>KPI</Label>
              <Input
                value={form.kpi_name}
                onChange={(e) => setForm({ ...form, kpi_name: e.target.value })}
                placeholder="er, reach…"
              />
            </div>
            <div className="space-y-2">
              <Label>Baseline</Label>
              <Input
                type="number"
                value={form.baseline_value}
                onChange={(e) => setForm({ ...form, baseline_value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Цель</Label>
              <Input
                type="number"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Дедлайн</Label>
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Теги (через запятую)</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Связанные посты</Label>
            <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
              {posts.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.linked_post_ids.includes(p.id)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        linked_post_ids: e.target.checked
                          ? [...f.linked_post_ids, p.id]
                          : f.linked_post_ids.filter((id) => id !== p.id),
                      }))
                    }}
                  />
                  <span className="truncate">
                    {p.published_at.slice(0, 10)} — {p.caption_preview?.slice(0, 40)}
                  </span>
                </label>
              ))}
              {!posts.length && (
                <p className="text-xs text-muted-foreground">Импортируйте посты для привязки</p>
              )}
            </div>
          </div>

          {(showCloseFields || CLOSED_STATUSES.includes(form.status)) && (
            <>
              <div className="space-y-2">
                <Label>Итог эксперимента *</Label>
                <Textarea
                  value={form.result_summary}
                  onChange={(e) => setForm({ ...form, result_summary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Фактическое значение KPI</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={form.actual_value}
                    onChange={(e) => setForm({ ...form, actual_value: e.target.value })}
                  />
                  <Button type="button" variant="outline" onClick={autoFillActual}>
                    Из метрик
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Отмена
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
