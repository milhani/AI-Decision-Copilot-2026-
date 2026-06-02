import { Router, type Response } from 'express'
import { getCachedProject, invalidateProject, setCachedProject } from '../cache.js'
import { runAiChat, streamAiChat, type AiChatRequest } from '../ai/llm.js'
import { saveAiSession } from '../db/ai-sessions.js'
import { assertProjectOwner } from '../db/ownership.js'
import { createDemoProject } from '../db/demo-seed.js'
import {
  createHypothesis,
  getHypothesis,
  updateHypothesis,
  type HypothesisWritePayload,
} from '../db/hypotheses.js'
import { updatePostNote } from '../db/posts.js'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type ProjectWritePayload,
} from '../db/projects.js'
import { loadProjectBundle } from '../db.js'
import { logError } from '../logger.js'
import type { AuthedRequest } from '../auth.js'
import { importRouter } from './import.js'

export const projectsRouter = Router()

const UUID_RE = /^[0-9a-f-]{36}$/i

function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

function sendDbError(res: Response, e: unknown, label: string) {
  logError(label, e)
  const err = e as NodeJS.ErrnoException
  if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    res.status(503).json({
      error: 'Нет связи с Supabase. Проверьте server/.env.',
    })
    return
  }
  const message = e instanceof Error ? e.message : 'Ошибка сервера'
  if (message.includes('не найден') || message.includes('лимит')) {
    res.status(message.includes('лимит') ? 400 : 404).json({ error: message })
    return
  }
  res.status(500).json({ error: message })
}

projectsRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const { projects, dbMs } = await listProjects(req.userId!)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(projects)
  } catch (e) {
    sendDbError(res, e, 'GET /api/projects')
  }
})

projectsRouter.post('/demo', async (req: AuthedRequest, res) => {
  try {
    const { projectId, dbMs } = await createDemoProject(req.userId!)
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.status(201).json({ projectId })
  } catch (e) {
    sendDbError(res, e, 'POST /api/projects/demo')
  }
})

projectsRouter.post('/', async (req: AuthedRequest, res) => {
  const body = req.body as ProjectWritePayload
  if (!body?.name?.trim()) {
    res.status(400).json({ error: 'Укажите название проекта' })
    return
  }

  try {
    const { project, dbMs } = await createProject(req.userId!, {
      name: body.name.trim(),
      description: body.description ?? null,
      niche_tags: body.niche_tags ?? [],
      channels: body.channels ?? [],
      optional_goal_text: body.optional_goal_text ?? null,
      optional_kpi_list: body.optional_kpi_list ?? null,
    })
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.status(201).json(project)
  } catch (e) {
    sendDbError(res, e, 'POST /api/projects')
  }
})

projectsRouter.use('/:projectId/import', importRouter)

projectsRouter.get('/:projectId/bundle', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const projectId = String(req.params.projectId)

  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const cached = getCachedProject(userId, projectId)
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    res.setHeader('X-Db-Time-Ms', '0')
    res.json(cached)
    return
  }

  try {
    const { bundle, dbMs } = await loadProjectBundle(projectId, userId)

    if (!bundle) {
      res.status(404).json({ error: 'Проект не найден' })
      return
    }

    setCachedProject(userId, projectId, bundle)

    res.setHeader('X-Cache', 'MISS')
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(bundle)
  } catch (e) {
    sendDbError(res, e, `GET /api/projects/${projectId}/bundle`)
  }
})

projectsRouter.post('/:projectId/invalidate-cache', (req: AuthedRequest, res) => {
  const userId = req.userId!
  const projectId = String(req.params.projectId)
  invalidateProject(userId, projectId)
  res.setHeader('X-Db-Time-Ms', '0')
  res.json({ ok: true })
})

projectsRouter.get('/:projectId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  try {
    const { project, dbMs } = await getProject(projectId, req.userId!)
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' })
      return
    }
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(project)
  } catch (e) {
    sendDbError(res, e, `GET /api/projects/${projectId}`)
  }
})

projectsRouter.patch('/:projectId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const body = req.body as ProjectWritePayload
  if (!body?.name?.trim()) {
    res.status(400).json({ error: 'Укажите название проекта' })
    return
  }

  try {
    const { project, dbMs } = await updateProject(projectId, req.userId!, {
      name: body.name.trim(),
      description: body.description ?? null,
      niche_tags: body.niche_tags ?? [],
      channels: body.channels ?? [],
      optional_goal_text: body.optional_goal_text ?? null,
      optional_kpi_list: body.optional_kpi_list ?? null,
    })
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(project)
  } catch (e) {
    sendDbError(res, e, `PATCH /api/projects/${projectId}`)
  }
})

projectsRouter.delete('/:projectId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  try {
    const { dbMs } = await deleteProject(projectId, req.userId!)
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json({ ok: true })
  } catch (e) {
    sendDbError(res, e, `DELETE /api/projects/${projectId}`)
  }
})

projectsRouter.patch('/:projectId/posts/:postId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  const postId = String(req.params.postId)
  if (!isUuid(projectId) || !isUuid(postId)) {
    res.status(400).json({ error: 'Некорректный id' })
    return
  }

  const { manual_note } = req.body as { manual_note?: string | null }

  try {
    const { dbMs } = await updatePostNote(
      projectId,
      postId,
      req.userId!,
      manual_note ?? null,
    )
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json({ ok: true })
  } catch (e) {
    sendDbError(res, e, `PATCH posts/${postId}`)
  }
})

projectsRouter.get('/:projectId/hypotheses/:hypothesisId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  const hypothesisId = String(req.params.hypothesisId)
  if (!isUuid(projectId) || !isUuid(hypothesisId)) {
    res.status(400).json({ error: 'Некорректный id' })
    return
  }

  try {
    const { hypothesis, dbMs } = await getHypothesis(
      projectId,
      hypothesisId,
      req.userId!,
    )
    if (!hypothesis) {
      res.status(404).json({ error: 'Гипотеза не найдена' })
      return
    }
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(hypothesis)
  } catch (e) {
    sendDbError(res, e, `GET hypotheses/${hypothesisId}`)
  }
})

projectsRouter.post('/:projectId/hypotheses', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const body = req.body as HypothesisWritePayload
  if (!body?.title?.trim()) {
    res.status(400).json({ error: 'Укажите название гипотезы' })
    return
  }

  try {
    const { hypothesis, dbMs } = await createHypothesis(projectId, req.userId!, {
      ...body,
      title: body.title.trim(),
    })
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.status(201).json(hypothesis)
  } catch (e) {
    sendDbError(res, e, `POST hypotheses`)
  }
})

projectsRouter.patch('/:projectId/hypotheses/:hypothesisId', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  const hypothesisId = String(req.params.hypothesisId)
  if (!isUuid(projectId) || !isUuid(hypothesisId)) {
    res.status(400).json({ error: 'Некорректный id' })
    return
  }

  const body = req.body as HypothesisWritePayload

  try {
    const { hypothesis, dbMs } = await updateHypothesis(
      projectId,
      hypothesisId,
      req.userId!,
      body,
    )
    invalidateProject(req.userId!, projectId)
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(hypothesis)
  } catch (e) {
    sendDbError(res, e, `PATCH hypotheses/${hypothesisId}`)
  }
})

projectsRouter.post('/:projectId/ai/chat', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const body = req.body as AiChatRequest
  if (!body?.mode) {
    res.status(400).json({ error: 'Укажите mode' })
    return
  }

  const useStream =
    req.query.stream === '1' ||
    req.headers.accept?.includes('text/event-stream')

  try {
    await assertProjectOwner(projectId, req.userId!)

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders?.()

      for await (const event of streamAiChat(body)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        if (event.type === 'error') break
      }
      res.end()
      return
    }

    const result = await runAiChat(body)
    res.setHeader('X-Db-Time-Ms', '0')
    res.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка AI'
    if (message.includes('не настроен')) {
      res.status(503).json({ error: message })
      return
    }
    if (useStream && !res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
      res.end()
      return
    }
    sendDbError(res, e, `POST ai/chat`)
  }
})

projectsRouter.post('/:projectId/ai/sessions', async (req: AuthedRequest, res) => {
  const projectId = String(req.params.projectId)
  if (!isUuid(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const { mode, messages } = req.body as { mode?: string; messages?: unknown }
  if (!mode) {
    res.status(400).json({ error: 'Укажите mode' })
    return
  }

  try {
    const { dbMs } = await saveAiSession(
      projectId,
      req.userId!,
      mode,
      messages ?? [],
    )
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.status(201).json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка сохранения сессии'
    logError('POST ai/sessions', e)
    // Не ломаем чат из-за журнала диалога
    res.status(201).json({ ok: false, warning: message })
  }
})
