import { timed } from '../logger.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { countProjects, createProject } from './projects.js'

const CAPTIONS = [
  'Утренний ритуал: 3 шага к сияющей коже ✨',
  'До/после: наш бестселлер за 2 недели',
  'Опрос: какой оттенок помады выберете весной?',
  'Reels: 15-секундный туториал с тоном',
  'История клиента — честный отзыв без фильтров',
  'Карусель: 5 ошибок в уходе зимой',
  'Анонс скидки -15% только до воскресенья',
  'Закулисье съёмки новой коллекции',
  'Сравнение текстур кремов: что выбрать?',
  'Итоги месяца: топ-3 продукта по отзывам',
]

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function subDays(date: Date, days: number): Date {
  return addDays(date, -days)
}

export async function createDemoProject(
  userId: string,
): Promise<{ projectId: string; dbMs: number }> {
  const n = await countProjects(userId)
  if (n >= 10) {
    throw new Error('Достигнут лимит проектов — удалите один, чтобы создать демо')
  }

  const { projectId, ms } = await timed('demo_seed.all', async () => {
    const { project } = await createProject(userId, {
      name: 'Демо: Косметика бренд',
      description: 'Демонстрационный проект с синтетическими данными за 90 дней',
      niche_tags: ['косметика', 'beauty'],
      channels: ['Instagram'],
      optional_goal_text: 'Увеличить ER на 15% за квартал',
      optional_kpi_list: ['er', 'reach'],
      is_demo: true,
    })

    const projectId = project.id
    const admin = getSupabaseAdmin()
    const baseDate = subDays(new Date(), 90)

    for (let i = 0; i < 10; i++) {
      const published = addDays(baseDate, i * 8 + Math.floor(Math.random() * 3))
      const reach = 8000 + Math.random() * 12000 + (i % 3 === 0 ? 5000 : 0)
      const likes = reach * (0.03 + Math.random() * 0.02)
      const comments = 20 + Math.random() * 80
      const er = ((likes + comments) / reach) * 100

      const { data: post, error: postErr } = await admin
        .from('posts')
        .insert({
          project_id: projectId,
          published_at: published.toISOString(),
          post_type: i % 4 === 0 ? 'reels' : 'post',
          caption_preview: CAPTIONS[i],
        })
        .select('id')
        .single()

      if (postErr) throw new Error(postErr.message)

      if (post) {
        const { error: mErr } = await admin.from('post_metrics').insert({
          post_id: post.id,
          reach: Math.round(reach),
          impressions: Math.round(reach * 1.3),
          er: Number(er.toFixed(2)),
          likes: Math.round(likes),
          comments: Math.round(comments),
          shares: Math.round(10 + Math.random() * 40),
          clicks: Math.round(50 + Math.random() * 200),
          saves: Math.round(30 + Math.random() * 100),
        })
        if (mErr) throw new Error(mErr.message)
      }
    }

    const { error: dsErr } = await admin.from('datasets').insert({
      project_id: projectId,
      file_name: 'demo_seed.csv',
      row_count: 10,
    })
    if (dsErr) throw new Error(dsErr.message)

    const { error: hErr } = await admin.from('hypotheses').insert([
      {
        project_id: projectId,
        title: 'Reels увеличат ER относительно каруселей',
        description: 'Сравниваем ER постов типа reels vs post за последние 30 дней',
        status: 'testing',
        kpi_name: 'er',
        baseline_value: 2.1,
        target_value: 2.8,
        tags: ['reels', 'формат'],
        linked_post_ids: [],
      },
      {
        project_id: projectId,
        title: 'Опросы в первом абзаце повысят комментарии',
        description: 'Посты с вопросом в начале vs без вопроса',
        status: 'confirmed',
        kpi_name: 'comments',
        baseline_value: 35,
        target_value: 55,
        actual_value: 62,
        result_summary: 'Пост с опросом показал +77% комментариев к baseline',
        tags: ['вовлечение'],
        linked_post_ids: [],
        closed_at: new Date().toISOString(),
      },
    ])
    if (hErr) throw new Error(hErr.message)

    return projectId
  })

  return { projectId, dbMs: ms }
}
