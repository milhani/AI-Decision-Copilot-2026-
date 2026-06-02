-- AI Decision Copilot for SMM — initial schema + RLS

create extension if not exists "uuid-ossp";

-- User profiles (onboarding)
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  onboarding_track text check (onboarding_track in ('analytics', 'hypothesis')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users manage own profile"
  on public.user_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  niche_tags text[] not null default '{}',
  channels text[] not null default '{}',
  optional_goal_text text,
  optional_kpi_list jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

create policy "Users CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Datasets
create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  imported_at timestamptz not null default now(),
  row_count int not null default 0
);

create index datasets_project_id_idx on public.datasets(project_id);

alter table public.datasets enable row level security;

create policy "Users manage datasets via project"
  on public.datasets for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  published_at timestamptz not null,
  post_type text not null default 'post',
  caption_preview text,
  external_url text,
  manual_note text,
  created_at timestamptz not null default now()
);

create index posts_project_id_idx on public.posts(project_id);
create index posts_published_at_idx on public.posts(published_at);

alter table public.posts enable row level security;

create policy "Users manage posts via project"
  on public.posts for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Post metrics
create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reach numeric,
  impressions numeric,
  er numeric,
  likes numeric,
  comments numeric,
  shares numeric,
  clicks numeric,
  saves numeric,
  custom_fields jsonb default '{}',
  recorded_at timestamptz not null default now()
);

create index post_metrics_post_id_idx on public.post_metrics(post_id);

alter table public.post_metrics enable row level security;

create policy "Users manage metrics via post"
  on public.post_metrics for all
  using (
    exists (
      select 1 from public.posts po
      join public.projects pr on pr.id = po.project_id
      where po.id = post_id and pr.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts po
      join public.projects pr on pr.id = po.project_id
      where po.id = post_id and pr.user_id = auth.uid()
    )
  );

-- Hypotheses
create type public.hypothesis_status as enum (
  'draft', 'testing', 'confirmed', 'rejected', 'postponed'
);

create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status public.hypothesis_status not null default 'draft',
  kpi_name text,
  baseline_value numeric,
  target_value numeric,
  deadline date,
  tags text[] not null default '{}',
  linked_post_ids uuid[] not null default '{}',
  result_summary text,
  actual_value numeric,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index hypotheses_project_id_idx on public.hypotheses(project_id);
create index hypotheses_status_idx on public.hypotheses(status);

alter table public.hypotheses enable row level security;

create policy "Users manage hypotheses via project"
  on public.hypotheses for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- AI sessions
create type public.ai_mode as enum ('analyst', 'coach');

create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mode public.ai_mode not null,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_sessions_project_id_idx on public.ai_sessions(project_id);

alter table public.ai_sessions enable row level security;

create policy "Users manage ai_sessions via project"
  on public.ai_sessions for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Project count limit helper (max 10)
create or replace function public.can_create_project(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select count(*) < 10 from public.projects where user_id = uid;
$$;
