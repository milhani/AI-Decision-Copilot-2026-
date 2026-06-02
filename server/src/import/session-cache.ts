import { randomUUID } from 'node:crypto'
import { LRUCache } from 'lru-cache'

export interface ImportSession {
  projectId: string
  userId: string
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  createdAt: number
}

const ttl = Number(process.env.IMPORT_SESSION_TTL_MS ?? 30 * 60_000)

const sessions = new LRUCache<string, ImportSession>({
  max: 100,
  ttl,
})

export function createImportSession(
  projectId: string,
  userId: string,
  fileName: string,
  headers: string[],
  rows: Record<string, string>[],
): string {
  const id = randomUUID()
  sessions.set(id, {
    projectId,
    userId,
    fileName,
    headers,
    rows,
    createdAt: Date.now(),
  })
  return id
}

export function getImportSession(importId: string, userId: string): ImportSession | undefined {
  const session = sessions.get(importId)
  if (!session || session.userId !== userId) return undefined
  return session
}

export function deleteImportSession(importId: string): void {
  sessions.delete(importId)
}
