import { createClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'
import { logWarn } from './logger.js'
import { isLocalJwtEnabled, verifySupabaseJwt } from './verify-jwt.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

let jwtSecretMismatchLogged = false

if (!supabaseUrl || !supabaseAnonKey) {
  logWarn('SUPABASE_URL / SUPABASE_ANON_KEY не заданы — auth middleware не сможет проверять JWT')
}

if (!isLocalJwtEnabled()) {
  logWarn(
    'SUPABASE_JWT_SECRET не задан — auth через сеть (медленнее). Dashboard → Settings → API → JWT Secret',
  )
}

export interface AuthedRequest extends Request {
  userId?: string
  accessToken?: string
}

const AUTH_NETWORK_MS = 8_000

async function verifyViaSupabaseNetwork(token: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), AUTH_NETWORK_MS)
  })

  const remote = supabase.auth
    .getUser(token)
    .then(({ data: { user }, error }) => (error || !user ? null : user.id))

  return Promise.race([remote, timeout])
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется Authorization: Bearer <token>' })
    return
  }

  const token = header.slice(7)

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Сервер не настроен (Supabase auth)' })
    return
  }

  const local = await verifySupabaseJwt(token)

  if (local.ok) {
    req.userId = local.userId
    req.accessToken = token
    next()
    return
  }

  // Просроченный JWT — сразу 401, refresh на клиенте
  if (local.reason === 'expired') {
    res.status(401).json({ error: 'Сессия истекла — обновите страницу или войдите снова' })
    return
  }

  // invalid / no_secret — проверка через Supabase (если JWT_SECRET в .env неверный)
  const userId = await verifyViaSupabaseNetwork(token)

  if (userId) {
    if (local.reason === 'invalid' && isLocalJwtEnabled() && !jwtSecretMismatchLogged) {
      jwtSecretMismatchLogged = true
      logWarn(
        'SUPABASE_JWT_SECRET не совпадает с проектом — локальная проверка отключена, используется сеть. Скопируйте JWT Secret: Dashboard → Settings → API (не anon/service_role ключ)',
      )
    }
    req.userId = userId
    req.accessToken = token
    next()
    return
  }

  res.status(401).json({
    error:
      local.reason === 'expired'
        ? 'Сессия истекла — обновите страницу или войдите снова'
        : 'Недействительный токен',
  })
}
