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

export interface ParseFileResult {
  headers: string[]
  rows: Record<string, string>[]
  mapping: Partial<Record<ColumnKey, string>>
  mappedPreview: ParsedRow[]
  mappedCount: number
}

export interface ImportResult {
  imported: number
  failed: number
  fileName: string
}
