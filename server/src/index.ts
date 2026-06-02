import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { requireAuth } from './auth.js'
import { closeDb } from './db.js'
import { logStartup, logWarn } from './logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { meRouter } from './routes/me.js'
import { projectsRouter } from './routes/projects.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const cacheTtlMs = Number(process.env.CACHE_TTL_MS ?? 60_000)

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logWarn(
    'SUPABASE_SERVICE_ROLE_KEY не задан — API не сможет читать БД (Settings → API → service_role)',
  )
}

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(requestLogger)

app.get('/health', (_req, res) => {
  res.setHeader('X-Db-Time-Ms', '0')
  res.json({ ok: true, ts: Date.now() })
})

app.use('/api/me', requireAuth, meRouter)
app.use('/api/projects', requireAuth, projectsRouter)

app.listen(port, () => {
  logStartup(port, cacheTtlMs)
})

process.on('SIGTERM', async () => {
  await closeDb()
  process.exit(0)
})
