import { API_URL, authHeaders } from '@/lib/api-client'
import type { ColumnKey } from '@/lib/import'
import type { ParsedRow } from '@/lib/import'

export interface ImportParseResponse {
  importId: string
  headers: string[]
  mapping: Partial<Record<ColumnKey, string>>
  mappedPreview: ParsedRow[]
  mappedCount: number
  rowCount: number
  fileName: string
}

export interface ImportConfirmResponse {
  imported: number
  failed: number
  fileName: string
}

export async function parseImportFile(
  projectId: string,
  file: File,
): Promise<ImportParseResponse> {
  const form = new FormData()
  form.append('file', file)

  const headers = await authHeaders()
  const { 'Content-Type': _, ...rest } = headers as Record<string, string>

  const res = await fetch(`${API_URL}/api/projects/${projectId}/import/parse`, {
    method: 'POST',
    headers: rest,
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Ошибка API (${res.status})`)
  }

  return res.json() as Promise<ImportParseResponse>
}

export async function previewImport(
  projectId: string,
  payload: { importId: string; mapping: Partial<Record<ColumnKey, string>> },
): Promise<{ mappedPreview: ParsedRow[]; mappedCount: number; rowCount: number }> {
  return apiPostJson(`/api/projects/${projectId}/import/preview`, payload)
}

async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  if (!res.ok) {
    throw new Error(String(parsed.error ?? `Ошибка API (${res.status})`))
  }
  return parsed as T
}

export async function confirmImport(
  projectId: string,
  payload: {
    importId: string
    mapping: Partial<Record<ColumnKey, string>>
  },
): Promise<ImportConfirmResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/import/confirm`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const text = await res.text()
    let body: Record<string, unknown> = {}
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      throw new Error(
        res.ok
          ? 'Некорректный ответ сервера'
          : `Ошибка импорта (${res.status}): ${text.slice(0, 200)}`,
      )
    }

    if (!res.ok) {
      throw new Error(String(body.error ?? `Ошибка импорта (${res.status})`))
    }

    return body as unknown as ImportConfirmResponse
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Импорт занял слишком много времени. Попробуйте файл поменьше.')
    }
    if (e instanceof TypeError && String(e.message).includes('terminated')) {
      throw new Error(
        'Соединение с API оборвалось. Убедитесь, что сервер запущен (cd server && npm run dev).',
      )
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
