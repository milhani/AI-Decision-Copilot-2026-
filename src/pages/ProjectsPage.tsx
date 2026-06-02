import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  createProject,
  deleteProject as deleteProjectApi,
  listProjects,
  updateProject,
} from '@/lib/projects-api'
import { MAX_PROJECTS, CHANNELS, KPI_OPTIONS } from '@/lib/constants'
import type { Project } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ProjectsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [step, setStep] = useState<'main' | 'goal'>('main')
  const [form, setForm] = useState({
    name: '',
    description: '',
    niche_tags: '',
    channels: [] as string[],
    optional_goal_text: '',
    optional_kpi_list: [] as string[],
  })

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = await listProjects()
      setProjects(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate('/onboarding')
      return
    }
    load()
  }, [load, profile, navigate])

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      niche_tags: '',
      channels: [],
      optional_goal_text: '',
      optional_kpi_list: [],
    })
    setStep('main')
    setEditing(null)
  }

  const openCreate = () => {
    if (projects.length >= MAX_PROJECTS) {
      toast.error(`Достигнут лимит: максимум ${MAX_PROJECTS} проектов`)
      return
    }
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (p: Project) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      niche_tags: p.niche_tags.join(', '),
      channels: p.channels,
      optional_goal_text: p.optional_goal_text ?? '',
      optional_kpi_list: (p.optional_kpi_list as string[]) ?? [],
    })
    setStep('main')
    setDialogOpen(true)
  }

  const saveProject = async (skipGoal = false) => {
    if (!user || !form.name.trim()) {
      toast.error('Укажите название проекта')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      niche_tags: form.niche_tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      channels: form.channels,
      optional_goal_text: skipGoal ? null : form.optional_goal_text.trim() || null,
      optional_kpi_list: skipGoal ? null : form.optional_kpi_list.length ? form.optional_kpi_list : null,
    }

    try {
      if (editing) {
        await updateProject(editing.id, payload)
        toast.success('Проект обновлён')
      } else {
        await createProject(payload)
        toast.success('Проект создан')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения')
      return
    }

    setDialogOpen(false)
    resetForm()
    load()
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Удалить проект и все данные?')) return
    try {
      await deleteProjectApi(id)
      toast.success('Проект удалён')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }))
  }

  if (loading) {
    return <p className="text-muted-foreground">Загрузка проектов…</p>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Проекты</h1>
          <p className="text-muted-foreground">
            {projects.length} / {MAX_PROJECTS} проектов
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Новый проект
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Пока нет проектов</p>
            <Button className="mt-4" onClick={openCreate}>
              Создать первый проект
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">
                  <Link to={`/projects/${p.id}/overview`} className="hover:text-primary">
                    {p.name}
                  </Link>
                  {p.is_demo && (
                    <span className="ml-2 text-xs font-normal text-primary">Демо</span>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {p.description || 'Без описания'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex gap-2">
                <div className="flex flex-wrap gap-1">
                  {p.channels.map((c) => (
                    <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteProject(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать проект' : 'Новый проект'}</DialogTitle>
          </DialogHeader>

          {step === 'main' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Бренд X — Instagram"
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
                <Label>Ниша (теги через запятую)</Label>
                <Input
                  value={form.niche_tags}
                  onChange={(e) => setForm({ ...form, niche_tags: e.target.value })}
                  placeholder="косметика, b2c"
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
                      onClick={() => toggleChannel(ch)}
                    >
                      {ch}
                    </Button>
                  ))}
                </div>
              </div>
              {!editing && (
                <Button className="w-full" onClick={() => setStep('goal')}>
                  Далее: цель (опционально)
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Отмена
                </Button>
                <Button className="flex-1" onClick={() => saveProject(editing !== null)}>
                  {editing ? 'Сохранить' : 'Создать без цели'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Цель проекта</Label>
                <Textarea
                  value={form.optional_goal_text}
                  onChange={(e) => setForm({ ...form, optional_goal_text: e.target.value })}
                  placeholder="Например: увеличить ER на 20% за квартал"
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
              <div className="flex flex-col gap-2">
                <Button onClick={() => saveProject(false)}>Создать с целью</Button>
                <Button variant="ghost" onClick={() => saveProject(true)}>
                  Пропустить цель
                </Button>
                <Button variant="outline" onClick={() => setStep('main')}>
                  Назад
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
