import { Link, useNavigate, useParams } from 'react-router-dom'
import { HYPOTHESIS_TEMPLATES, ER_CHECKLIST } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HypothesisTemplatesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Библиотека шаблонов</h1>
        <p className="text-muted-foreground">Готовые формулировки гипотез для экспериментов</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {HYPOTHESIS_TEMPLATES.map((t, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">{t.title}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/projects/${id}/hypotheses/new`, {
                    state: {
                      prefill: {
                        title: t.title,
                        description: t.description,
                        kpi_name: t.kpi_name,
                        tags: t.tags.join(', '),
                      },
                    },
                  })
                }
              >
                Использовать шаблон
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Падение ER — что проверить</CardTitle>
          <CardDescription>Чеклист из {ER_CHECKLIST.length} пунктов</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm">
            {ER_CHECKLIST.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link to={`/projects/${id}/hypotheses`}>← К реестру гипотез</Link>
      </Button>
    </div>
  )
}
