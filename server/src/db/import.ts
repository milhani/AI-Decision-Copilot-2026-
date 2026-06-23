import { getCachedProject, refreshProjectCache } from '../cache.js'
import { logInfo, timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import type { ParsedRow } from '../import/types.js'

/** PostgREST комфортно принимает до ~500 строк за запрос */
const MAX_CHUNK = 500

async function insertChunk(
  projectId: string,
  rows: ParsedRow[],
): Promise<{ imported: number; failed: number }> {
  const admin = getSupabaseAdmin()

  const postsPayload = rows.map((row) => ({
    project_id: projectId,
    published_at: row.date,
    caption_preview: row.caption.slice(0, 200),
    post_type: 'post',
  }))

  const { data: posts, error: postsError } = await admin
    .from('posts')
    .insert(postsPayload)
    .select('id')

  if (postsError || !posts?.length) {
    return { imported: 0, failed: rows.length }
  }

  const metricsPayload = posts.map((post, idx) => {
    const row = rows[idx]
    return {
      post_id: post.id,
      reach: row.reach ?? null,
      impressions: row.impressions ?? null,
      er: row.er ?? null,
      likes: row.likes ?? null,
      comments: row.comments ?? null,
      shares: row.shares ?? null,
      clicks: row.clicks ?? null,
    }
  })

  const { error: metricsError } = await admin.from('post_metrics').insert(metricsPayload)

  if (metricsError) {
    return { imported: 0, failed: posts.length }
  }

  return { imported: posts.length, failed: 0 }
}

export async function importPosts(
  projectId: string,
  userId: string,
  fileName: string,
  rows: ParsedRow[],
  options?: { skipOwnershipCheck?: boolean },
): Promise<{ result: { imported: number; failed: number; fileName: string }; dbMs: number }> {
  const { data, ms } = await timed(`import.bulk (${rows.length} rows)`, async () => {
    if (!rows.length) {
      throw new Error('Нет строк для импорта')
    }

    const admin = getSupabaseAdmin()

    if (!options?.skipOwnershipCheck && !getCachedProject(userId, projectId)) {
      const { data: owned, ms: checkMs } = await timed('import.check_owner', async () => {
        const { data, error } = await admin
          .from('projects')
          .select('id')
          .eq('id', projectId)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return Boolean(data)
      })
      if (!owned) throw new Error('Проект не найден')
      if (checkMs > 2000) {
        logInfo(`Проверка владельца проекта заняла ${Math.round(checkMs)}ms — проверьте регион Supabase`)
      }
    }

    let imported = 0
    let failed = 0

    if (rows.length <= MAX_CHUNK) {
      const { data: chunkResult, ms: chunkMs } = await timed('import.insert_chunk', () =>
        insertChunk(projectId, rows),
      )
      imported = chunkResult.imported
      failed = chunkResult.failed
      if (chunkMs > 5000) {
        logInfo(
          `Вставка ${rows.length} постов: ${Math.round(chunkMs)}ms — обычно <3s; смотрите регион/паузу проекта Supabase`,
        )
      }
    } else {
      for (let i = 0; i < rows.length; i += MAX_CHUNK) {
        const chunk = rows.slice(i, i + MAX_CHUNK)
        const label = `import.chunk ${i / MAX_CHUNK + 1}`
        const { data: chunkResult } = await timed(label, () => insertChunk(projectId, chunk))
        imported += chunkResult.imported
        failed += chunkResult.failed
      }
    }

    if (imported > 0) {
      await timed('import.dataset', async () => {
        const { error } = await admin.from('datasets').insert({
          project_id: projectId,
          file_name: fileName,
          row_count: imported,
        })
        if (error) throw new Error(error.message)
      })
      await refreshProjectCache(userId, projectId)
    }

    return { imported, failed, fileName }
  })

  return { result: data, dbMs: ms }
}
