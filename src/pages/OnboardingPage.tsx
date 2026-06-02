import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, FlaskConical, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { updateUserProfile } from '@/lib/profile-api'
import { createDemoProject } from '@/lib/demo-seed'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)

  const completeOnboarding = async (
    track: 'analytics' | 'hypothesis',
    demoProjectId?: string,
  ) => {
    if (!user) return
    setLoading(track)

    await updateUserProfile({
      onboarding_completed: true,
      onboarding_track: track,
    })

    await refreshProfile()
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
    await updateUserProfile({
      onboarding_completed: true,
      onboarding_track: 'analytics',
    })
    await refreshProfile()
    setLoading(null)
    toast.success('Демо-проект создан')
    navigate(`/projects/${id}/overview`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Добро пожаловать в AI Decision Copilot</h1>
        <p className="mt-2 text-muted-foreground">
          Платформа для интерпретации метрик и системной работы с гипотезами — не генератор контента.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <BarChart3 className="mb-2 h-8 w-8 text-primary" />
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

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <FlaskConical className="mb-2 h-8 w-8 text-primary" />
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

      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader>
          <Sparkles className="mb-2 h-6 w-6 text-primary" />
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
