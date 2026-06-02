import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ColumnKey =
  | 'date'
  | 'caption'
  | 'reach'
  | 'impressions'
  | 'er'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'clicks'

export const COLUMN_KEYS: ColumnKey[] = [
  'date',
  'caption',
  'reach',
  'impressions',
  'er',
  'likes',
  'comments',
  'shares',
  'clicks',
]

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  date: 'Дата публикации',
  caption: 'Текст поста',
  reach: 'Охват',
  impressions: 'Показы',
  er: 'ER',
  likes: 'Лайки',
  comments: 'Комментарии',
  shares: 'Репосты',
  clicks: 'Клики',
}

export interface ParsedRow {
  date: string
  caption: string
  reach?: number
  impressions?: number
  er?: number
  likes?: number
  comments?: number
  shares?: number
  clicks?: number
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function normalizeHeader(h: string): string {
  return stripBom(h).trim()
}

function normalizeRows(
  headers: string[],
  rows: Record<string, string>[],
): { headers: string[]; rows: Record<string, string>[] } {
  const cleanHeaders = headers.map(normalizeHeader)
  const normalized = rows.map((row) => {
    const out: Record<string, string> = {}
    for (const [key, val] of Object.entries(row)) {
      out[normalizeHeader(key)] = val
    }
    return out
  })
  return { headers: cleanHeaders, rows: normalized }
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = stripBom(await file.text())
    const delimiter = detectDelimiter(text)

    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        complete: (results) => {
          const headers = (results.meta.fields ?? []).map(normalizeHeader)
          const { headers: h, rows } = normalizeRows(headers, results.data)
          if (!h.length || !rows.length) {
            reject(
              new Error(
                'Файл пустой или неверный разделитель. Сохраните CSV с запятыми или точкой с запятой (Excel → CSV UTF-8).',
              ),
            )
            return
          }
          resolve({ headers: h, rows })
        },
        error: (err: Error) => reject(err),
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    const headers = json.length ? Object.keys(json[0]) : []
    return { headers, rows: json }
  }

  throw new Error('Поддерживаются только CSV и XLSX')
}

export function validateMapping(
  mapping: Partial<Record<ColumnKey, string>>,
): { ok: boolean; missing: string[] } {
  const required: ColumnKey[] = ['date', 'caption']
  const missing = required
    .filter((k) => !mapping[k])
    .map((k) => COLUMN_LABELS[k])
  return { ok: missing.length === 0, missing }
}

export function guessLiveDuneMapping(headers: string[]): Partial<Record<ColumnKey, string>> {
  const lower = headers.map((h) => ({ orig: h, low: h.toLowerCase() }))
  const find = (...needles: string[]) =>
    lower.find(({ low }) => needles.some((n) => low.includes(n)))?.orig

  return {
    date: find('дата', 'date', 'published', 'время'),
    caption: find('текст', 'caption', 'описание', 'сообщен', 'пост'),
    reach: find('охват', 'reach'),
    impressions: find('показ', 'impression'),
    er: find('er', 'вовлеч'),
    likes: find('лайк', 'like'),
    comments: find('коммент', 'comment'),
    shares: find('репост', 'share'),
    clicks: find('клик', 'click'),
  }
}

function parseNum(val: string | undefined): number | undefined {
  if (!val) return undefined
  const n = parseFloat(String(val).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function parseDate(val: string): string | null {
  const d = new Date(val)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  const parts = val.split(/[./-]/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number)
    const tryDate = new Date(c > 1000 ? c : a, (c > 1000 ? b : b) - 1, c > 1000 ? a : c)
    if (!Number.isNaN(tryDate.getTime())) return tryDate.toISOString()
  }
  return null
}

export function mapRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<ColumnKey, string>>,
): ParsedRow[] {
  const result: ParsedRow[] = []
  for (const row of rows) {
    const get = (key: ColumnKey) => {
      const col = mapping[key]
      return col ? String(row[col] ?? '').trim() : ''
    }
    const dateStr = get('date')
    const iso = dateStr ? parseDate(dateStr) : null
    if (!iso) continue

    result.push({
      date: iso,
      caption: get('caption') || 'Без текста',
      reach: parseNum(get('reach')),
      impressions: parseNum(get('impressions')),
      er: parseNum(get('er')),
      likes: parseNum(get('likes')),
      comments: parseNum(get('comments')),
      shares: parseNum(get('shares')),
      clicks: parseNum(get('clicks')),
    })
  }
  return result
}
