-- Один запрос: проект + посты с последней метрикой + гипотезы

create or replace function public.get_project_bundle(p_project_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and user_id = v_uid
  ) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'project', (
      select to_jsonb(p)
      from public.projects p
      where p.id = p_project_id
    ),
    'posts', coalesce((
      select jsonb_agg(
        to_jsonb(po) || jsonb_build_object(
          'post_metrics',
          coalesce(
            (
              select jsonb_agg(to_jsonb(pm))
              from (
                select *
                from public.post_metrics
                where post_id = po.id
                order by recorded_at desc
                limit 1
              ) pm
            ),
            '[]'::jsonb
          )
        )
        order by po.published_at asc
      )
      from public.posts po
      where po.project_id = p_project_id
    ), '[]'::jsonb),
    'hypotheses', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at desc)
      from public.hypotheses h
      where h.project_id = p_project_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_project_bundle(uuid) to authenticated;

comment on function public.get_project_bundle(uuid) is
  'Возвращает проект, посты с последней метрикой и гипотезы одним запросом (RLS через security invoker).';
