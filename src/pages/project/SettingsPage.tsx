import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  deleteProject as deleteProjectApi,
  getProject,
  updateProject,
} from '@/lib/projects-api'
import { CHANNELS, KPI_OPTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SettingsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    niche_tags: '',
    channels: [] as string[],
    optional_goal_text: '',
    optional_kpi_list: [] as string[],
  })

  useEffect(() => {
    if (!id) return
    getProject(id)
      .then((p) => {
        setForm({
          name: p.name,
          description: p.description ?? '',
          niche_tags: p.niche_tags.join(', '),
          channels: p.channels,
          optional_goal_text: p.optional_goal_text ?? '',
          optional_kpi_list: (p.optional_kpi_list as string[]) ?? [],
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Ошибка загрузки'))
  }, [id])

  const save = async () => {
    if (!id) return
    try {
      await updateProject(id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        niche_tags: form.niche_tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        channels: form.channels,
        optional_goal_text: form.optional_goal_text.trim() || null,
        optional_kpi_list: form.optional_kpi_list.length ? form.optional_kpi_list : null,
      })
      toast.success('Настройки сохранены')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  const deleteProject = async () => {
    if (!id || !confirm('Удалить проект безвозвратно?')) return
    try {
      await deleteProjectApi(id)
      toast.success('Проект удалён')
      navigate('/projects')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Настройки проекта</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основное</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Ниша</Label>
            <Input
              value={form.niche_tags}
              onChange={(e) => setForm({ ...form, niche_tags: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Каналы</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <Button
                  key={ch}
                  type="button"
                  size="sm"
                  variant={form.channels.includes(ch) ? 'default' : 'outline'}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      channels: f.channels.includes(ch)
                        ? f.channels.filter((c) => c !== ch)
                        : [...f.channels, ch],
                    }))
                  }
                >
                  {ch}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Цель</Label>
            <Textarea
              value={form.optional_goal_text}
              onChange={(e) => setForm({ ...form, optional_goal_text: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>KPI</Label>
            <div className="flex flex-wrap gap-2">
              {KPI_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={form.optional_kpi_list.includes(value) ? 'default' : 'outline'}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      optional_kpi_list: f.optional_kpi_list.includes(value)
                        ? f.optional_kpi_list.filter((k) => k !== value)
                        : [...f.optional_kpi_list, value],
                    }))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={save}>Сохранить</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Опасная зона</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={deleteProject}>
            Удалить проект
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
