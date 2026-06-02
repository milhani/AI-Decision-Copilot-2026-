import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  FileText,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectBundleProvider } from '@/contexts/ProjectBundleContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const projectNav = [
  { to: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { to: 'import', label: 'Импорт данных', icon: Upload },
  { to: 'hypotheses', label: 'Гипотезы', icon: FlaskConical },
  { to: 'ai', label: 'AI-ассистент', icon: Bot },
  { to: 'report', label: 'Отчёт', icon: FileText },
  { to: 'settings', label: 'Настройки', icon: Settings },
]

export function AppShell() {
  const { id } = useParams<{ id: string }>()
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="border-b border-border p-4">
          <Link to="/projects" className="text-sm font-semibold text-primary">
            AI Decision Copilot
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link
            to="/projects"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FolderKanban className="h-4 w-4" />
            Список проектов
          </Link>

          {id && (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Проект
              </div>
              {projectNav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={`/projects/${id}/${to}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" />
            Выход
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {id && (
          <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 md:hidden">
            <BarChart3 className="h-5 w-5 text-primary" />
            <select
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
              value={location.pathname}
              onChange={(e) => navigate(e.target.value)}
            >
              {projectNav.map(({ to, label }) => (
                <option key={to} value={`/projects/${id}/${to}`}>
                  {label}
                </option>
              ))}
            </select>
          </header>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {id ? (
            <ProjectBundleProvider key={id} projectId={id}>
              <Outlet />
            </ProjectBundleProvider>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
