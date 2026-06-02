import { LRUCache } from 'lru-cache'
import type { ProjectBundle, UserProfile } from './types.js'

const ttl = Number(process.env.CACHE_TTL_MS ?? 60_000)

const projectStore = new LRUCache<string, ProjectBundle>({ max: 200, ttl })
const profileStore = new LRUCache<string, UserProfile>({ max: 500, ttl })

export function projectCacheKey(userId: string, projectId: string): string {
  return `project:${userId}:${projectId}`
}

export function getCachedProject(userId: string, projectId: string): ProjectBundle | undefined {
  return projectStore.get(projectCacheKey(userId, projectId))
}

export function setCachedProject(userId: string, projectId: string, bundle: ProjectBundle): void {
  projectStore.set(projectCacheKey(userId, projectId), bundle)
}

export function invalidateProject(userId: string, projectId: string): void {
  projectStore.delete(projectCacheKey(userId, projectId))
}

export function getCachedProfile(userId: string): UserProfile | undefined {
  return profileStore.get(`profile:${userId}`)
}

export function setCachedProfile(userId: string, profile: UserProfile): void {
  profileStore.set(`profile:${userId}`, profile)
}

export function invalidateProfile(userId: string): void {
  profileStore.delete(`profile:${userId}`)
}
