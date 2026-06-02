import { Router } from 'express'
import { getCachedProfile, invalidateProfile, setCachedProfile } from '../cache.js'
import { loadUserProfile, updateUserProfile } from '../db/profile.js'
import { logError } from '../logger.js'
import type { AuthedRequest } from '../auth.js'

export const meRouter = Router()

meRouter.get('/profile', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const forceRefresh = req.query.refresh === '1'

  if (!forceRefresh) {
    const cached = getCachedProfile(userId)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('X-Db-Time-Ms', '0')
      res.json(cached)
      return
    }
  }

  try {
    const { profile, dbMs } = await loadUserProfile(userId)
    if (profile) setCachedProfile(userId, profile)

    res.setHeader('X-Cache', forceRefresh ? 'REFRESH' : 'MISS')
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(profile)
  } catch (e) {
    logError('GET /api/me/profile', e)
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Ошибка загрузки профиля',
    })
  }
})

meRouter.patch('/profile', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const body = req.body as {
    onboarding_completed?: boolean
    onboarding_track?: 'analytics' | 'hypothesis' | null
  }

  try {
    const { profile, dbMs } = await updateUserProfile(userId, {
      onboarding_completed: body.onboarding_completed,
      onboarding_track: body.onboarding_track,
    })
    setCachedProfile(userId, profile)
    res.setHeader('X-Cache', 'MISS')
    res.setHeader('X-Db-Time-Ms', String(Math.round(dbMs)))
    res.json(profile)
  } catch (e) {
    logError('PATCH /api/me/profile', e)
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Ошибка обновления профиля',
    })
  }
})

meRouter.post('/profile/invalidate-cache', (req: AuthedRequest, res) => {
  invalidateProfile(req.userId!)
  res.setHeader('X-Db-Time-Ms', '0')
  res.json({ ok: true })
})
