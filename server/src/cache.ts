import { LRUCache } from 'lru-cache'
import { loadProjectBundle } from './db.js'
import type { Hypothesis, Project, ProjectBundle, UserProfile } from './types.js'

/** 0 = кэш живёт до invalidate / перезапуска сервера */
const ttlMs = Number(process.env.CACHE_TTL_MS ?? 0)

const projectOpts = {
  max: 200,
  ...(ttlMs > 0 ? { ttl: ttlMs } : {}),
}

const profileOpts = {
  max: 500,
  ...(ttlMs > 0 ? { ttl: ttlMs } : {}),
}

const aiChatsOpts = {
  max: 300,
  ...(ttlMs > 0 ? { ttl: ttlMs } : {}),
}

export type AiChatSummary = {
  id: string
  project_id: string
  mode: 'analyst' | 'coach' | 'chat'
  title: string | null
  created_at: string
  updated_at: string
}

export type AiChatFull = AiChatSummary & {
  messages: unknown[]
  context_snapshot: unknown | null
}

const projectStore = new LRUCache<string, ProjectBundle>(projectOpts)
const profileStore = new LRUCache<string, UserProfile>(profileOpts)
const ownershipStore = new LRUCache<string, true>(projectOpts)
const aiChatsListStore = new LRUCache<string, AiChatSummary[]>(aiChatsOpts)
const aiChatStore = new LRUCache<string, AiChatFull>(aiChatsOpts)

export function projectCacheKey(userId: string, projectId: string): string {
  return `project:${userId}:${projectId}`
}

export function getCachedProject(userId: string, projectId: string): ProjectBundle | undefined {
  return projectStore.get(projectCacheKey(userId, projectId))
}

export function setCachedProject(userId: string, projectId: string, bundle: ProjectBundle): void {
  projectStore.set(projectCacheKey(userId, projectId), bundle)
  markProjectOwned(userId, projectId)
}

export function invalidateProject(userId: string, projectId: string): void {
  projectStore.delete(projectCacheKey(userId, projectId))
  ownershipStore.delete(projectCacheKey(userId, projectId))
  invalidateAiChats(userId, projectId)
}

export function markProjectOwned(userId: string, projectId: string): void {
  ownershipStore.set(projectCacheKey(userId, projectId), true)
}

export function isProjectOwned(userId: string, projectId: string): boolean {
  return Boolean(getCachedProject(userId, projectId) || ownershipStore.get(projectCacheKey(userId, projectId)))
}

export function patchCachedProject(
  userId: string,
  projectId: string,
  patch: (bundle: ProjectBundle) => ProjectBundle,
): boolean {
  const key = projectCacheKey(userId, projectId)
  const current = projectStore.get(key)
  if (!current) return false
  projectStore.set(key, patch(structuredClone(current)))
  return true
}

export function updateCachedProjectMeta(
  userId: string,
  projectId: string,
  project: Project,
): boolean {
  return patchCachedProject(userId, projectId, (bundle) => ({ ...bundle, project }))
}

export function updateCachedPostNote(
  userId: string,
  projectId: string,
  postId: string,
  manualNote: string | null,
): boolean {
  return patchCachedProject(userId, projectId, (bundle) => ({
    ...bundle,
    posts: bundle.posts.map((p) =>
      p.id === postId ? { ...p, manual_note: manualNote } : p,
    ),
  }))
}

export function upsertCachedHypothesis(
  userId: string,
  projectId: string,
  hypothesis: Hypothesis,
): boolean {
  return patchCachedProject(userId, projectId, (bundle) => {
    const idx = bundle.hypotheses.findIndex((h) => h.id === hypothesis.id)
    if (idx === -1) {
      return { ...bundle, hypotheses: [hypothesis, ...bundle.hypotheses] }
    }
    const hypotheses = [...bundle.hypotheses]
    hypotheses[idx] = hypothesis
    return { ...bundle, hypotheses }
  })
}

/** Перезагрузить bundle из БД и положить в кэш (после импорта, демо и т.п.) */
export async function refreshProjectCache(
  userId: string,
  projectId: string,
): Promise<ProjectBundle | null> {
  const { bundle } = await loadProjectBundle(projectId, userId)
  if (bundle) {
    setCachedProject(userId, projectId, bundle)
  } else {
    invalidateProject(userId, projectId)
  }
  return bundle
}

export function seedEmptyProjectCache(userId: string, project: Project): void {
  setCachedProject(userId, project.id, {
    project,
    posts: [],
    hypotheses: [],
  })
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

function aiChatsListKey(userId: string, projectId: string): string {
  return `aiChats:${userId}:${projectId}`
}

function aiChatKey(userId: string, projectId: string, chatId: string): string {
  return `aiChat:${userId}:${projectId}:${chatId}`
}

export function getCachedAiChatsList(userId: string, projectId: string): AiChatSummary[] | undefined {
  return aiChatsListStore.get(aiChatsListKey(userId, projectId))
}

export function setCachedAiChatsList(
  userId: string,
  projectId: string,
  chats: AiChatSummary[],
): void {
  aiChatsListStore.set(aiChatsListKey(userId, projectId), chats)
}

export function upsertCachedAiChatSummary(userId: string, chat: AiChatSummary): void {
  const list = getCachedAiChatsList(userId, chat.project_id)
  if (!list) return

  const idx = list.findIndex((c) => c.id === chat.id)
  const next = [...list]
  if (idx === -1) {
    next.unshift(chat)
  } else {
    next[idx] = chat
  }
  next.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  setCachedAiChatsList(userId, chat.project_id, next)
}

export function removeCachedAiChatSummary(
  userId: string,
  projectId: string,
  chatId: string,
): void {
  const list = getCachedAiChatsList(userId, projectId)
  if (!list) return
  setCachedAiChatsList(
    userId,
    projectId,
    list.filter((c) => c.id !== chatId),
  )
}

export function invalidateAiChats(userId: string, projectId: string): void {
  const prefix = `aiChat:${userId}:${projectId}:`
  aiChatsListStore.delete(aiChatsListKey(userId, projectId))
  for (const key of aiChatStore.keys()) {
    if (key.startsWith(prefix)) aiChatStore.delete(key)
  }
}

export function getCachedAiChat(
  userId: string,
  projectId: string,
  chatId: string,
): AiChatFull | undefined {
  return aiChatStore.get(aiChatKey(userId, projectId, chatId))
}

export function setCachedAiChat(userId: string, chat: AiChatFull): void {
  aiChatStore.set(aiChatKey(userId, chat.project_id, chat.id), chat)
  upsertCachedAiChatSummary(userId, chat)
}

export function removeCachedAiChat(userId: string, projectId: string, chatId: string): void {
  aiChatStore.delete(aiChatKey(userId, projectId, chatId))
  removeCachedAiChatSummary(userId, projectId, chatId)
}

export function getProjectCacheTtlMs(): number {
  return ttlMs
}
