import { useProjectBundle } from '@/contexts/ProjectBundleContext'

/** Данные проекта из общего контекста — один запрос bundle на проект */
export function useProject(_projectId?: string) {
  const ctx = useProjectBundle()
  return {
    project: ctx.project,
    posts: ctx.posts,
    hypotheses: ctx.hypotheses,
    loading: ctx.loading,
    error: ctx.error,
    reload: ctx.reload,
  }
}
