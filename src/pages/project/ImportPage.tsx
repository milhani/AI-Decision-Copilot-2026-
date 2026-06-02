import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { confirmImport, parseImportFile, previewImport } from '@/lib/import-api'
import {
  COLUMN_KEYS,
  COLUMN_LABELS,
  validateMapping,
  type ColumnKey,
} from '@/lib/import'
import type { ParsedRow } from '@/lib/import'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ImportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [importId, setImportId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Partial<Record<ColumnKey, string>>>({})
  const [mappedPreview, setMappedPreview] = useState<ParsedRow[]>([])
  const [mappedCount, setMappedCount] = useState(0)
  const [rowCount, setRowCount] = useState(0)
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [importing, setImporting] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [summary, setSummary] = useState<{ posts: number; file: string; failed: number } | null>(
    null,
  )
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshPreview = useCallback(async () => {
    if (!projectId || !importId) return
    try {
      const data = await previewImport(projectId, { importId, mapping })
      setMappedPreview(data.mappedPreview)
      setMappedCount(data.mappedCount)
      setRowCount(data.rowCount)
    } catch {
      // тихо — при первом открытии уже есть preview с parse
    }
  }, [projectId, importId, mapping])

  useEffect(() => {
    if (importId && step !== 'upload') {
      const t = setTimeout(refreshPreview, 300)
      return () => clearTimeout(t)
    }
  }, [mapping, importId, step, refreshPreview])

  const handleFile = async (f: File) => {
    if (!projectId) return
    setParsing(true)
    setLastError(null)
    try {
      const parsed = await parseImportFile(projectId, f)
      setImportId(parsed.importId)
      setFileName(parsed.fileName)
      setHeaders(parsed.headers)
      setMapping(parsed.mapping)
      setMappedPreview(parsed.mappedPreview)
      setMappedCount(parsed.mappedCount)
      setRowCount(parsed.rowCount)
      setStep('map')

      if (!parsed.mappedCount) {
        toast.warning(
          'Не удалось распознать даты. Проверьте колонку «Дата» на шаге сопоставления.',
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка чтения файла')
    } finally {
      setParsing(false)
    }
  }

  const goPreview = () => {
    const v = validateMapping(mapping)
    if (!v.ok) {
      toast.error(`Укажите колонки: ${v.missing.join(', ')}`)
      return
    }
    if (!mappedCount) {
      toast.error('Нет строк с корректной датой')
      return
    }
    setStep('preview')
  }

  const confirmImportAction = async () => {
    if (!projectId || !importId) return

    setImporting(true)
    setLastError(null)

    try {
      const result = await confirmImport(projectId, { importId, mapping })
      setSummary({ posts: result.imported, file: result.fileName, failed: result.failed })

      if (result.failed > 0) {
        toast.warning(`Импортировано ${result.imported}, ошибок: ${result.failed}`)
      } else {
        toast.success(`Импортировано ${result.imported} постов`)
      }
      setStep('done')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка импорта'
      setLastError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Импорт данных</h1>
        <p className="text-muted-foreground">CSV или XLSX — разбор и запись через API</p>
      </div>

      {lastError && (
        <Card className="border-destructive/30 bg-red-50/50">
          <CardContent className="py-4 text-sm text-destructive">{lastError}</CardContent>
        </Card>
      )}

      {step === 'upload' && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-center text-muted-foreground">
              Перетащите файл или выберите CSV/XLSX
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="text-sm"
              disabled={parsing}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {parsing && (
              <p className="mt-4 text-sm text-muted-foreground">Разбор файла на сервере…</p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сопоставление колонок</CardTitle>
            <CardDescription>Пресет LiveDune — данные файла хранятся на сервере</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COLUMN_KEYS.map((key) => (
              <div key={key} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <Label>
                  {COLUMN_LABELS[key]}
                  {(key === 'date' || key === 'caption') && ' *'}
                </Label>
                <Select
                  value={mapping[key] ?? '__none__'}
                  onValueChange={(v) =>
                    setMapping((m) => ({
                      ...m,
                      [key]: v === '__none__' ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите колонку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не использовать —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              К импорту: <strong>{mappedCount}</strong> из {rowCount} строк
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Назад
              </Button>
              <Button onClick={goPreview}>Предпросмотр</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Первые 5 строк</CardTitle>
            <CardDescription>Импорт {mappedCount} постов из файла {fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Дата</th>
                    <th className="p-2 text-left">Текст</th>
                    <th className="p-2 text-left">Охват</th>
                    <th className="p-2 text-left">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{r.date.slice(0, 10)}</td>
                      <td className="max-w-[200px] truncate p-2">{r.caption}</td>
                      <td className="p-2">{r.reach ?? '—'}</td>
                      <td className="p-2">{r.er ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep('map')}>
                Назад
              </Button>
              <Button disabled={importing || !importId} onClick={confirmImportAction}>
                {importing ? 'Импорт…' : `Подтвердить (${mappedCount})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'done' && summary && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle>Импорт завершён</CardTitle>
            <CardDescription>
              {summary.file} — {summary.posts} постов
              {summary.failed > 0 ? `, ошибок: ${summary.failed}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={`/projects/${projectId}/overview`}>Перейти к обзору</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
