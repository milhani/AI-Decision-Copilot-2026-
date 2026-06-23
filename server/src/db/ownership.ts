import { getCachedProject, isProjectOwned, setCachedProject } from '../cache.js'
import { loadProjectBundle } from '../db.js'

/**
 * Проверка доступа к проекту через кэш bundle.
 * При первом обращении грузим bundle из БД и кладём в память — дальше только кэш.
 */
export async function assertProjectOwner(
  projectId: string,
  userId: string,
): Promise<void> {
  if (isProjectOwned(userId, projectId)) return

  const { bundle } = await loadProjectBundle(projectId, userId)
  if (!bundle) throw new Error('Проект не найден')

  setCachedProject(userId, projectId, bundle)
}

/** Bundle из кэша или однократная загрузка из БД */
export async function ensureProjectBundle(projectId: string, userId: string) {
  const cached = getCachedProject(userId, projectId)
  if (cached) return cached

  const { bundle } = await loadProjectBundle(projectId, userId)
  if (!bundle) throw new Error('Проект не найден')

  setCachedProject(userId, projectId, bundle)
  return bundle
}
