-- Assistant IA: on/off per agency, monthly quota per plan, document search.
-- Answers are never stored: one activity_log row per question (tools used, no text).

alter table public.plans
  add column ai_monthly_questions int check (ai_monthly_questions is null or ai_monthly_questions >= 0);
update public.plans set ai_monthly_questions = case code when 'essentiel' then 0 when 'pro' then 300 else 1500 end;

-- Admins can switch the assistant off for their agency (Settings).
alter table public.agencies add column ai_enabled boolean not null default true;

-- Full-text search on the agency's documents ('simple' works for fr, ar and en).
alter table public.ai_chunks
  add column fts tsvector generated always as (to_tsvector('simple'::regconfig, content)) stored;
create index ai_chunks_fts_idx on public.ai_chunks using gin (fts);

-- ---------------------------------------------------------------------------
-- Quota: is the assistant usable, and how many questions are left this month?
-- Counts activity_log rows (staff cannot read that table, hence definer).
-- ---------------------------------------------------------------------------
create or replace function public.ai_quota(p_agency uuid)
returns table (enabled boolean, plan_allows boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- security definer: current_user is the owner here, so check the JWT user instead
  if (select auth.uid()) is not null and not public.is_member(p_agency) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
  select a.ai_enabled,
         coalesce(p.ai_enabled, false),
         (select count(*)::int from public.activity_log l
           where l.agency_id = a.id and l.action = 'assistant.question'
             and l.created_at >= date_trunc('month', now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca'),
         p.ai_monthly_questions
  from public.agencies a
  left join public.plans p on p.id = a.plan_id
  where a.id = p_agency;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search the agency's documents. Words of 2+ letters, prefix match, OR.
-- ---------------------------------------------------------------------------
create or replace function public.search_chunks(p_agency uuid, p_query text, p_k int default 5)
returns table (chunk_id uuid, document_id uuid, title text, content text, rank real)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q tsquery;
begin
  if not public.is_member(p_agency) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select to_tsquery('simple', string_agg(w || ':*', ' | '))
    into v_q
  from (
    select distinct lower(w) as w
    from regexp_split_to_table(coalesce(p_query, ''), '[^[:alnum:]]+') w
    where char_length(w) >= 2
    limit 20
  ) words;
  if v_q is null then
    return;
  end if;
  return query
  select c.id, c.document_id, d.title, c.content, ts_rank(c.fts, v_q) as rank
  from public.ai_chunks c
  join public.ai_documents d on d.agency_id = c.agency_id and d.id = c.document_id
  where c.agency_id = p_agency and c.fts @@ v_q
  order by rank desc
  limit least(greatest(coalesce(p_k, 5), 1), 10);
end;
$$;

revoke execute on function public.ai_quota(uuid) from public, anon;
revoke execute on function public.search_chunks(uuid, text, int) from public, anon;
grant execute on function public.ai_quota(uuid) to authenticated, service_role;
grant execute on function public.search_chunks(uuid, text, int) to authenticated, service_role;
