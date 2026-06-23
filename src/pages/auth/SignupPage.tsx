import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await signUp(email, password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/onboarding')
  }

  return (
    <div className="auth-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md page-enter">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Создайте аккаунт</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Начните работу с метриками и гипотезами
          </p>
        </div>

        <Card className="border-border/60 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle>Регистрация</CardTitle>
            <CardDescription>Бесплатный доступ к платформе</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.ru"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль (мин. 6 символов)</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Создание…' : 'Зарегистрироваться'}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Войти
              </Link>
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Гипотезы
          </span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI-коуч
          </span>
        </div>
      </div>
    </div>
  )
}
