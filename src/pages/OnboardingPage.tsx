import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, FlaskConical, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { updateUserProfile } from '@/lib/profile-api'
import { createDemoProject } from '@/lib/demo-seed'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function OnboardingPage() {
  const { user, applyProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)

  const completeOnboarding = async (
    track: 'analytics' | 'hypothesis',
    demoProjectId?: string,
  ) => {
    if (!user) return
    setLoading(track)

    const updated = await updateUserProfile({
      onboarding_completed: true,
      onboarding_track: track,
    })
    applyProfile(updated)
    setLoading(null)

    if (demoProjectId) {
      navigate(`/projects/${demoProjectId}/overview`)
      return
    }

    navigate('/projects')
    toast.success('Добро пожаловать! Выберите или создайте проект.')
  }

  const handleDemo = async () => {
    if (!user) return
    setLoading('demo')
    const id = await createDemoProject()
    if (!id) {
      toast.error('Не удалось создать демо-проект')
      setLoading(null)
      return
    }
    const updated = await updateUserProfile({
      onboarding_completed: true,
      onboarding_track: 'analytics',
    })
    applyProfile(updated)
    setLoading(null)
    toast.success('Демо-проект создан')
    navigate(`/projects/${id}/overview`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4 page-enter">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Добро пожаловать в Decision Copilot
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Платформа для интерпретации метрик и системной работы с гипотезами — не генератор
          контента.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card
          className={cn(
            'group cursor-pointer border-border/80 transition-all duration-200 hover:border-primary/25 hover:shadow-md',
          )}
        >
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
              <BarChart3 className="h-5 w-5" />
            </div>
            <CardTitle>Разобраться в цифрах</CardTitle>
            <CardDescription>Импорт CSV, дашборд, аномалии и AI-аналитик</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={!!loading}
              onClick={() => completeOnboarding('analytics')}
            >
              {loading === 'analytics' ? 'Загрузка…' : 'Выбрать этот путь'}
            </Button>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'group cursor-pointer border-border/80 transition-all duration-200 hover:border-primary/25 hover:shadow-md',
          )}
        >
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-transform duration-200 group-hover:scale-105">
              <FlaskConical className="h-5 w-5" />
            </div>
            <CardTitle>Завести первую гипотезу</CardTitle>
            <CardDescription>Шаблоны экспериментов и реестр гипотез</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              disabled={!!loading}
              onClick={() => completeOnboarding('hypothesis')}
            >
              {loading === 'hypothesis' ? 'Загрузка…' : 'Выбрать этот путь'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <CardTitle>Демо-проект</CardTitle>
          <CardDescription>
            «Демо: Косметика бренд» — 10 постов, метрики за 90 дней и 2 гипотезы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" disabled={!!loading} onClick={handleDemo}>
            {loading === 'demo' ? 'Создание демо…' : 'Создать демо-проект'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
