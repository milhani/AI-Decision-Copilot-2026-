import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3,
  Bot,
  FileText,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
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
  const location = useLocation()

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/80 bg-sidebar md:flex">
        <div className="border-b border-border/80 p-5">
          <Link to="/projects" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-foreground">
                Decision Copilot
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                SMM Analytics
              </span>
            </div>
          </Link>
          {user?.email && (
            <p className="mt-3 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          <Link
            to="/projects"
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              location.pathname === '/projects'
                ? 'bg-primary/10 text-primary shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <FolderKanban className="h-4 w-4" />
            Список проектов
          </Link>

          {id && (
            <>
              <div className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                Текущий проект
              </div>
              {projectNav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={`/projects/${id}/${to}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 font-medium text-primary shadow-xs'
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

        <div className="border-t border-border/80 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
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
          <header className="flex items-center gap-3 border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-sm md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <select
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/25"
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
