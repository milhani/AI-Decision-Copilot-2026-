import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchProjectBundle,
  reloadProjectBundle,
  type ProjectBundle,
} from '@/lib/project-api'
import type { Hypothesis, PostWithMetrics, Project } from '@/types/database'

interface ProjectBundleContextValue {
  projectId: string
  project: Project | null
  posts: PostWithMetrics[]
  hypotheses: Hypothesis[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const ProjectBundleContext = createContext<ProjectBundleContextValue | null>(null)

export function ProjectBundleProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const [project, setProject] = useState<Project | null>(null)
  const [posts, setPosts] = useState<PostWithMetrics[]>([])
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasDataRef = useRef(false)

  const applyBundle = useCallback((bundle: ProjectBundle) => {
    setProject(bundle.project)
    setPosts(bundle.posts)
    setHypotheses(bundle.hypotheses)
    hasDataRef.current = true
  }, [])

  const load = useCallback(
    async (refresh = false) => {
      if (!refresh || !hasDataRef.current) {
        setLoading(true)
      }
      setError(null)

      try {
        const bundle = refresh
          ? await reloadProjectBundle(projectId)
          : await fetchProjectBundle(projectId)
        applyBundle(bundle)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка загрузки проекта'
        setError(message)
        console.error('[ProjectBundle]', message)
      } finally {
        setLoading(false)
      }
    },
    [applyBundle, projectId],
  )

  useEffect(() => {
    hasDataRef.current = false
    setProject(null)
    setPosts([])
    setHypotheses([])
    void load(false)
  }, [projectId, load])

  const reload = useCallback(async () => {
    await load(true)
  }, [load])

  const value = useMemo(
    () => ({
      projectId,
      project,
      posts,
      hypotheses,
      loading,
      error,
      reload,
    }),
    [projectId, project, posts, hypotheses, loading, error, reload],
  )

  return (
    <ProjectBundleContext.Provider value={value}>{children}</ProjectBundleContext.Provider>
  )
}

export function useProjectBundle() {
  const ctx = useContext(ProjectBundleContext)
  if (!ctx) {
    throw new Error('useProjectBundle вне ProjectBundleProvider (страницы проекта в AppShell)')
  }
  return ctx
}
