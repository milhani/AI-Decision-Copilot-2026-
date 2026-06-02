/** ANSI-цвета для читаемых логов в терминале */
const esc = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

export function formatDuration(ms: number): string {
  if (ms < 1) return `${esc.dim}<1ms${esc.reset}`
  if (ms < 1000) {
    const color = ms < 100 ? esc.green : ms < 400 ? esc.yellow : esc.red
    return `${color}${Math.round(ms)}ms${esc.reset}`
  }
  const sec = (ms / 1000).toFixed(2)
  return `${esc.red}${sec}s${esc.reset}`
}

function statusColor(code: number): string {
  if (code >= 500) return esc.red
  if (code >= 400) return esc.yellow
  if (code >= 300) return esc.cyan
  return esc.green
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return esc.cyan
    case 'POST':
      return esc.green
    case 'PATCH':
      return esc.yellow
    case 'DELETE':
      return esc.red
    default:
      return esc.white
  }
}

function cacheLabel(cache?: string): string {
  if (!cache) return `${esc.dim}     —${esc.reset}`
  const map: Record<string, string> = {
    HIT: `${esc.green}cache HIT ${esc.reset}`,
    MISS: `${esc.magenta}cache MISS${esc.reset}`,
    REFRESH: `${esc.yellow}cache REF${esc.reset}`,
  }
  return map[cache] ?? `${esc.dim}cache ${cache}${esc.reset}`
}

export interface HttpLogEntry {
  method: string
  path: string
  status: number
  totalMs: number
  cache?: string
  dbMs?: number
  userId?: string
}

export function logHttp(entry: HttpLogEntry): void {
  const time = new Date().toLocaleTimeString('ru-RU', { hour12: false })
  const ms = entry.totalMs
  const method = padEnd(entry.method, 6)
  const path = pad(entry.path, 52)
  const status = pad(String(entry.status), 3)
  const db =
    entry.dbMs != null && entry.dbMs > 0
      ? `db ${formatDuration(entry.dbMs)}`
      : `${esc.dim}db  —${esc.reset}`

  const user = entry.userId
    ? `${esc.dim}user ${entry.userId.slice(0, 8)}…${esc.reset}`
    : ''

  console.log(
    `${esc.dim}${time}${esc.reset}  ` +
      `${methodColor(entry.method)}${method}${esc.reset}` +
      `${esc.white}${path}${esc.reset}  ` +
      `${statusColor(entry.status)}${status}${esc.reset}  ` +
      `${esc.bold}Σ ${formatDuration(ms)}${esc.reset}  ` +
      `${cacheLabel(entry.cache)}  ` +
      `${db}` +
      (user ? `  ${user}` : ''),
  )
}

export function logInfo(message: string): void {
  console.log(`${esc.blue}ℹ${esc.reset}  ${message}`)
}

export function logSuccess(message: string): void {
  console.log(`${esc.green}✓${esc.reset}  ${message}`)
}

export function logWarn(message: string): void {
  console.warn(`${esc.yellow}⚠${esc.reset}  ${message}`)
}

export function logError(label: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`${esc.red}✗${esc.reset}  ${esc.bold}${label}${esc.reset}  ${msg}`)
  if (err instanceof Error && err.stack && process.env.LOG_STACK === '1') {
    console.error(`${esc.dim}${err.stack}${esc.reset}`)
  }
}

export function logStartup(port: number, cacheTtlMs: number): void {
  const line = '─'.repeat(44)
  console.log('')
  console.log(`${esc.cyan}${esc.bold}  SMM Decision Copilot — API${esc.reset}`)
  console.log(`${esc.dim}  ${line}${esc.reset}`)
  console.log(`  ${esc.green}→${esc.reset}  http://localhost:${port}`)
  console.log(`  ${esc.dim}cache TTL:${esc.reset}  ${cacheTtlMs / 1000}s`)
  console.log(`  ${esc.dim}логи:${esc.reset}     запросы + Σ время + cache + db`)
  console.log(`${esc.dim}  ${line}${esc.reset}`)
  console.log('')
}

/** Замер асинхронной операции (Supabase и т.д.) */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ data: T; ms: number }> {
  const start = performance.now()
  const data = await fn()
  const ms = performance.now() - start
  if (process.env.LOG_DB === '1' || ms > 500) {
    console.log(
      `       ${esc.dim}↳${esc.reset} ${esc.gray}${padEnd(label, 28)}${esc.reset} ${formatDuration(ms)}`,
    )
  }
  return { data, ms }
}
