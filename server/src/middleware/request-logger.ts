import type { Request, Response, NextFunction } from 'express'
import { logHttp } from '../logger.js'
import type { AuthedRequest } from '../auth.js'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now()

  res.on('finish', () => {
    const totalMs = performance.now() - start
    const cache = res.getHeader('X-Cache')
    const dbHeader = res.getHeader('X-Db-Time-Ms')
    const authed = req as AuthedRequest

    logHttp({
      method: req.method,
      path: req.originalUrl.split('?')[0] ?? req.path,
      status: res.statusCode,
      totalMs,
      cache: cache ? String(cache) : undefined,
      dbMs: dbHeader ? Number(dbHeader) : undefined,
      userId: authed.userId,
    })
  })

  next()
}
