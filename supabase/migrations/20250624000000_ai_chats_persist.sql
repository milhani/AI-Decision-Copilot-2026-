-- Персистентные диалоги AI: заголовок и снимок контекста
alter table public.ai_sessions
  add column if not exists title text,
  add column if not exists context_snapshot jsonb;

create index if not exists ai_sessions_project_mode_updated_idx
  on public.ai_sessions(project_id, mode, updated_at desc);
