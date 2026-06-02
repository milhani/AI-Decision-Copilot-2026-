import { jwtVerify } from 'jose'

const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim()

let secretKey: Uint8Array | null = null

function getSecretKey(): Uint8Array | null {
  if (!jwtSecret) return null
  if (!secretKey) secretKey = new TextEncoder().encode(jwtSecret)
  return secretKey
}

export type JwtVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'no_secret' | 'expired' | 'invalid' }

/** Проверка JWT локально, без запроса в Supabase Auth */
export async function verifySupabaseJwt(token: string): Promise<JwtVerifyResult> {
  const key = getSecretKey()
  if (!key) return { ok: false, reason: 'no_secret' }

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    })

    const sub = payload.sub
    if (typeof sub !== 'string' || !sub) {
      return { ok: false, reason: 'invalid' }
    }

    return { ok: true, userId: sub }
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    const code = (e as { code?: string }).code
    if (name === 'JWTExpired' || code === 'ERR_JWT_EXPIRED') {
      return { ok: false, reason: 'expired' }
    }
    return { ok: false, reason: 'invalid' }
  }
}

export function isLocalJwtEnabled(): boolean {
  return Boolean(jwtSecret)
}
