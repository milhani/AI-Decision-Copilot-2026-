-- Индексы для быстрой загрузки bundle на бэкенде
create index if not exists post_metrics_post_id_recorded_at_idx
  on public.post_metrics (post_id, recorded_at desc);

create index if not exists hypotheses_project_created_idx
  on public.hypotheses (project_id, created_at desc);
