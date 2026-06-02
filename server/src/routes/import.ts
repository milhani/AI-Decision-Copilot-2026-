import { Router } from 'express'
import multer from 'multer'
import { mapRows, parseUploadedFile } from '../import/parser.js'
import { importPosts } from '../db/import.js'
import {
  createImportSession,
  deleteImportSession,
  getImportSession,
} from '../import/session-cache.js'
import { logError } from '../logger.js'
import type { AuthedRequest } from '../auth.js'
import type { ColumnKey } from '../import/types.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

export const importRouter = Router({ mergeParams: true })

/** Разбор CSV/XLSX — данные остаются на сервере, клиенту отдаётся только importId */
importRouter.post('/parse', upload.single('file'), async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const projectId = String(req.params.projectId)

  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    res.status(400).json({ error: 'Некорректный projectId' })
    return
  }

  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Файл не передан (поле file)' })
    return
  }

  try {
    const parsed = await parseUploadedFile(file.buffer, file.originalname)
    const importId = createImportSession(
      projectId,
      userId,
      file.originalname,
      parsed.headers,
      parsed.rows,
    )

    res.setHeader('X-Db-Time-Ms', '0')
    res.json({
      importId,
      headers: parsed.headers,
      mapping: parsed.mapping,
      mappedPreview: parsed.mappedPreview,
      mappedCount: parsed.mappedCount,
      rowCount: parsed.rows.length,
      fileName: file.originalname,
    })
  } catch (e) {
    logError('POST /import/parse', e)
    res.status(400).json({
      error: e instanceof Error ? e.message : 'Ошибка чтения файла',
    })
  }
})

/** Предпросмотр после смены маппинга */
importRouter.post('/preview', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const projectId = String(req.params.projectId)
  const body = req.body as {
    importId?: string
    mapping?: Partial<Record<ColumnKey, string>>
  }

  if (!body.importId || !body.mapping) {
    res.status(400).json({ error: 'Нужны importId и mapping' })
    return
  }

  const session = getImportSession(body.importId, userId)
  if (!session || session.projectId !== projectId) {
    res.status(404).json({ error: 'Сессия импорта не найдена. Загрузите файл снова.' })
    return
  }

  const mapped = mapRows(session.rows, body.mapping)
  res.setHeader('X-Db-Time-Ms', '0')
  res.json({
    mappedPreview: mapped.slice(0, 5),
    mappedCount: mapped.length,
    rowCount: session.rows.length,
  })
})

/** Подтверждение — только importId + mapping, без повторной отправки всех строк */
importRouter.post('/confirm', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const projectId = String(req.params.projectId)

  const body = req.body as {
    importId?: string
    mapping?: Partial<Record<ColumnKey, string>>
  }

  if (!body.importId || !body.mapping) {
    res.status(400).json({ error: 'Нужны importId и mapping' })
    return
  }

  const session = getImportSession(body.importId, userId)
  if (!session || session.projectId !== projectId) {
    res.status(404).json({
      error: 'Сессия импорта не найдена или истекла. Загрузите файл снова.',
    })
    return
  }

  const rows = mapRows(session.rows, body.mapping)
  if (!rows.length) {
    res.status(400).json({ error: 'Нет валидных строк для импорта' })
    return
  }

  try {
    const { result, dbMs } = await importPosts(projectId, userId, session.fileName, rows, {
      skipOwnershipCheck: true,
    })
    deleteImportSession(body.importId)

    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))

    if (result.imported === 0) {
      res.status(422).json({
        error: 'Не удалось импортировать ни одной строки',
        ...result,
      })
      return
    }

    res.json(result)
  } catch (e) {
    logError('POST /import/confirm', e)
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Ошибка импорта',
    })
  }
})
