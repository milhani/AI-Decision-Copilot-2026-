import type { AiMessage } from '@/types/database'

export interface MockAiContext {
  aggregated: {
    avgReach: number
    avgEr: number
    postCount: number
  }
  topPosts: {
    date: string
    caption?: string
    reach?: number | null
    er?: number | null
    likes?: number | null
    comments?: number | null
  }[]
  bottomPosts: MockAiContext['topPosts']
  activeHypotheses: {
    title: string
    status: string
    kpi?: string | null
  }[]
}

export interface MockAiPayload {
  mode: 'analyst' | 'coach'
  scenario?: string
  coachStep?: number
  messages?: AiMessage[]
  context: MockAiContext
}

export interface MockAiResult {
  content: string
  confidence: 'низкая' | 'средняя' | 'высокая'
}

function evidenceBlock(ctx: MockAiContext): string {
  const lines = ctx.topPosts.map(
    (p) =>
      `- ${p.date}: «${(p.caption ?? '').slice(0, 50)}» — охват ${p.reach ?? '—'}, ER ${p.er ?? '—'}%`,
  )
  if (ctx.bottomPosts.length) {
    lines.push('', '_Слабые посты:_')
    ctx.bottomPosts.slice(0, 3).forEach((p) => {
      lines.push(
        `- ${p.date}: охват ${p.reach ?? '—'}, ER ${p.er ?? '—'}%`,
      )
    })
  }
  return lines.join('\n')
}

function analystErDrop(ctx: MockAiContext): MockAiResult {
  const { avgEr, avgReach, postCount } = ctx.aggregated
  const worst = ctx.bottomPosts[0]
  const best = ctx.topPosts[0]

  return {
    confidence: postCount >= 5 ? 'средняя' : 'низкая',
    content: `## Возможные причины падения ER

За последние 30 дней по **${postCount}** постам средний ER — **${avgEr.toFixed(2)}%**, средний охват — **${Math.round(avgReach)}**.

### Проверяемые гипотезы
1. **Формат контента** — сравнить ER постов типа reels/карусель; лучший пост (${best?.date}): ER ${best?.er}%, худший (${worst?.date}): ER ${worst?.er}%.
2. **Охват vs вовлечение** — падение ER при росте охвата может означать «холодную» аудиторию, а не просадку качества.
3. **Частота публикаций** — перегруз ленты за короткий период снижает ER без изменения креатива.
4. **CTA и длина текста** — посты с коротким текстом и без вопроса в начале могут давать меньше комментариев.
5. **Активные эксперименты** — сверить с гипотезами в статусе «тестируется»${ctx.activeHypotheses.length ? `: ${ctx.activeHypotheses.map((h) => h.title).join('; ')}` : ''}.

### На чём основан вывод
${evidenceBlock(ctx)}

**Уверенность:** ${postCount >= 5 ? 'средняя' : 'низкая'} _(демо-режим, данные из проекта)_`,
  }
}

function analystAnomalies(ctx: MockAiContext): MockAiResult {
  const top = ctx.topPosts[0]
  const low = ctx.bottomPosts[0]
  const spread =
    top?.er && low?.er ? Math.abs(Number(top.er) - Number(low.er)).toFixed(2) : '—'

  return {
    confidence: 'средняя',
    content: `## Аномалии и возможные причины

Разброс ER между лучшим и худшим постом: **${spread} п.п.** (без ML, по правилу сравнения постов периода).

### Проверяемые гипотезы
1. **Выброс по охвату** — пост ${top?.date} с охватом ${top?.reach} мог завысить средние; исключите его при расчёте «нормы».
2. **Просадка вовлечения** — пост ${low?.date} (ER ${low?.er}%) — проверить время публикации и обложку/первый кадр.
3. **Несопоставимые форматы** — не сравнивайте reels и статичные посты в одной выборке.
4. **Сезонность** — сопоставьте с аналогичным периодом месяц назад (нужен импорт большего окна).
5. **Внешние факторы** — акции конкурентов, праздники, технические сбои платформы.

### На чём основан вывод
${evidenceBlock(ctx)}

**Уверенность:** средняя _(демо-режим)_`,
  }
}

function analystTopPosts(ctx: MockAiContext): MockAiResult {
  const list = ctx.topPosts
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.date} — ER ${p.er}%, охват ${p.reach}, «${(p.caption ?? '').slice(0, 40)}…»`)
    .join('\n')

  return {
    confidence: 'высокая',
    content: `## Посты, которые сработали лучше всего

Рейтинг по ER и охвату за период (топ-5 из импортированных данных):

${list}

### Проверяемые гипотезы
1. **Повторить формат лидера** — разобрать структуру поста №1 (хук, визуал, CTA) и оформить A/B на 3 публикации.
2. **Время публикации** — зафиксировать час публикации топ-3 и протестировать тот же слот.
3. **Тема/боль аудитории** — общий мотив успешных постов можно вынести в отдельную гипотезу для серии.
4. **Длина и медиа** — сравнить тип поста (reels/post) у топа vs медианы.
5. **Не масштабировать виральный выброс** — один пост с аномальным охватом не должен стать единственным benchmark.

### На чём основан вывод
${evidenceBlock(ctx)}

**Уверенность:** высокая _(демо-режим, только импортированные метрики)_`,
  }
}

function coachFinal(ctx: MockAiContext, messages: AiMessage[]): MockAiResult {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const direction = /лид|lead/i.test(lastUser)
    ? 'лиды'
    : /сообществ|community/i.test(lastUser)
      ? 'сообщество'
      : /охват|reach/i.test(lastUser)
        ? 'охват'
        : 'охват'

  const hints: Record<string, string> = {
    охват: 'тест слота публикации, коллаборации, серийный контент',
    лиды: 'лид-магнит в stories, чёткий CTA в посте, UTM-ссылки',
    сообщество: 'опросы, UGC, ответы в комментариях в первый час',
  }

  return {
    confidence: 'средняя',
    content: `## Направления для экспериментов (не контент-план)

Приоритет, который вы выбрали: **${direction}**.

Рекомендуем **2–3 направления**, каждое — как отдельная гипотеза в реестре:

1. **${direction} — гипотеза A** — ${hints[direction]}; KPI: ${direction === 'лиды' ? 'клики / лиды' : direction === 'сообщество' ? 'комментарии / прирост подписчиков' : 'охват'}.
2. **${direction} — гипотеза B** — сравнить 2 формата за 14 дней с одинаковой частотой.
3. **Контроль качества данных** — убедиться, что импорт покрывает полный период теста.

Я **не** составляю помесячный контент-план — только направления для ваших гипотез.

### На чём основан вывод
- Диалог коуча: ${messages.filter((m) => m.role === 'user').length} ответов пользователя
- Метрики проекта: ${ctx.aggregated.postCount} постов, ср. ER ${ctx.aggregated.avgEr.toFixed(2)}%

**Уверенность:** средняя _(демо-режим)_`,
  }
}

function analystFollowUp(messages: AiMessage[]): MockAiResult {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? 'вопрос'
  return {
    confidence: 'средняя',
    content: `## Уточнение

По вашему вопросу: **${lastUser.slice(0, 200)}**

1. Сверьте вывод с последними 2–3 неделями импорта — возможен лаг данных.
2. Проверьте гипотезу на подмножестве постов (один формат / одна рубрика).
3. Зафиксируйте KPI и срок теста в реестре гипотез.

### На чём основан вывод
- Продолжение диалога; опираюсь на предыдущий ответ и импортированные метрики.

**Уверенность:** средняя _(демо-режим)_`,
  }
}

function coachFollowUp(messages: AiMessage[]): MockAiResult {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  return {
    confidence: 'средняя',
    content: `## Ответ на уточнение

${lastUser ? `Вы спросили: «${lastUser.slice(0, 300)}»\n\n` : ''}Рекомендую оформить одну новую гипотезу в реестре и измерить эффект за 14 дней — без расширения контент-плана.

**Уверенность:** средняя _(демо-режим)_`,
  }
}

export function getMockAiResponse(
  payload: MockAiPayload,
  hasData: boolean,
): MockAiResult {
  if (!hasData) {
    return {
      confidence: 'низкая',
      content: `Данных по проекту пока нет.

Импортируйте CSV/XLSX с метриками постов (раздел «Импорт данных»), затем повторите сценарий. Без импорта я не могу ссылаться на конкретные цифры.

### На чём основан вывод
- Импортированных постов: 0

**Уверенность:** низкая`,
    }
  }

  const ctx = payload.context
  const thread = payload.messages ?? []
  const hasAssistant = thread.some((m) => m.role === 'assistant')

  if (payload.mode === 'coach') {
    if (hasAssistant) return coachFollowUp(thread)
    return coachFinal(ctx, thread)
  }

  if (hasAssistant) return analystFollowUp(thread)

  switch (payload.scenario) {
    case 'anomalies':
      return analystAnomalies(ctx)
    case 'top_posts':
      return analystTopPosts(ctx)
    case 'er_drop':
    default:
      return analystErDrop(ctx)
  }
}

/** Имитация задержки сети для реалистичного UX в демо */
export function mockAiDelay(ms = 800): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
