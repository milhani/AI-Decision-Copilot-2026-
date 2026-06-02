export const MAX_PROJECTS = 10

export const CHANNELS = ['VK', 'Telegram', 'Instagram'] as const

export const KPI_OPTIONS = [
  { value: 'reach', label: 'Охват' },
  { value: 'er', label: 'ER (вовлечённость)' },
  { value: 'leads', label: 'Лиды' },
  { value: 'community', label: 'Рост сообщества' },
] as const

export const HYPOTHESIS_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  testing: 'Тестируется',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  postponed: 'Отложена',
}

export const LIVEDUNE_PRESET: Record<string, string> = {
  date: 'Дата',
  caption: 'Текст',
  reach: 'Охват',
  impressions: 'Показы',
  er: 'ER',
  likes: 'Лайки',
  comments: 'Комментарии',
  shares: 'Репосты',
  clicks: 'Клики',
}

export const HYPOTHESIS_TEMPLATES = [
  {
    title: 'Новый формат Reels увеличит ER',
    description:
      'Гипотеза: короткие видео в формате Reels дадут более высокий ER, чем статичные карусели за тот же период.',
    kpi_name: 'er',
    tags: ['формат', 'reels'],
  },
  {
    title: 'Публикация в 19:00 даст больший охват',
    description:
      'Гипотеза: сдвиг времени публикации на 19:00 (МСК) увеличит средний охват постов в будни.',
    kpi_name: 'reach',
    tags: ['тайминг'],
  },
  {
    title: 'Вопрос в первом абзаце повысит комментарии',
    description:
      'Гипотеза: открывающий вопрос в первом абзаце увеличит число комментариев относительно baseline.',
    kpi_name: 'comments',
    tags: ['копирайт', 'вовлечение'],
  },
  {
    title: 'UGC-контент усилит доверие и ER',
    description:
      'Гипотеза: репосты отзывов клиентов дадут ER выше, чем продуктовые посты без соцдоказательства.',
    kpi_name: 'er',
    tags: ['ugc', 'доверие'],
  },
  {
    title: 'Серия из 3 постов увеличит охват финального',
    description:
      'Гипотеза: прогрев серией из 3 публикаций повысит охват заключительного поста акции.',
    kpi_name: 'reach',
    tags: ['серия', 'акция'],
  },
  {
    title: 'Короткий CTA в конце повысит клики',
    description:
      'Гипотеза: явный CTA в последней строке увеличит клики по ссылке в bio/сторис.',
    kpi_name: 'clicks',
    tags: ['cta'],
  },
]

export const ER_CHECKLIST = [
  'Сравните ER за два соседних периода (не менее 7 дней)',
  'Проверьте, не изменился ли охват (малый охват искажает ER)',
  'Исключите виральный выброс — один пост с аномальным ER',
  'Сверьте типы контента: видео vs карусель vs текст',
  'Проверьте частоту публикаций — перегруз ленты снижает ER',
  'Учтите сезонность и праздники в нише',
  'Сравните время публикации топ- и аутсайдеров',
  'Проверьте технические сбои (блокировки, shadowban)',
  'Сопоставьте с активными гипотезами в статусе «Тестируется»',
  'Зафиксируйте вывод в гипотезе и закройте эксперимент',
]

export const ANALYST_SCENARIOS = [
  { id: 'er_drop', label: 'Объясни падение ER за период' },
  { id: 'anomalies', label: 'Найди аномалии и возможные причины' },
  { id: 'top_posts', label: 'Какие посты сработали лучше всего?' },
] as const
