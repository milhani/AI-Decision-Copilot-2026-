import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ColumnKey, ParseFileResult, ParsedRow } from './types.js'

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

export async function parseUploadedFile(
  buffer: Buffer,
  originalName: string,
): Promise<ParseFileResult> {
  const ext = originalName.split('.').pop()?.toLowerCase()
  let headers: string[] = []
  let rows: Record<string, string>[] = []

  if (ext === 'csv') {
    const text = stripBom(buffer.toString('utf8'))
    const delimiter = detectDelimiter(text)
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
    })
    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message ?? 'Ошибка CSV')
    }
    headers = (parsed.meta.fields ?? []).map(normalizeHeader)
    const normalized = normalizeRows(headers, parsed.data)
    headers = normalized.headers
    rows = normalized.rows
  } else if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    headers = json.length ? Object.keys(json[0]).map(normalizeHeader) : []
    rows = json.map((row) => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) out[normalizeHeader(k)] = String(v ?? '')
      return out
    })
  } else {
    throw new Error('Поддерживаются только CSV и XLSX')
  }

  if (!headers.length || !rows.length) {
    throw new Error(
      'Файл пустой или неверный разделитель. Сохраните CSV UTF-8 с запятыми или точкой с запятой.',
    )
  }

  const mapping = guessLiveDuneMapping(headers)
  const mapped = mapRows(rows, mapping)

  return {
    headers,
    rows,
    mapping,
    mappedPreview: mapped.slice(0, 5),
    mappedCount: mapped.length,
  }
}
