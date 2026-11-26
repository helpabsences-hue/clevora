-- Rate limiting (login, password reset, signup, invitations, assistant).
-- Only the server (service role) touches this table; keys are hashed.

create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  hits          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index rate_limits_window_idx on public.rate_limits (window_start);
create trigger set_updated_at before update on public.rate_limits
  for each row execute function public.set_updated_at();

alter table public.rate_limits enable row level security;
-- Nobody but the service role (which bypasses RLS) can read or write it.
create policy rate_limits_none on public.rate_limits for all to authenticated, anon using (false) with check (false);
revoke all on public.rate_limits from anon, authenticated;

/**
 * Count one attempt for p_key in a fixed window. Returns true when the attempt
 * is allowed, false when the limit is reached (the attempt is still counted).
 */
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

/** Daily job: forget old windows. */
create or replace function public.rate_limit_cleanup()
returns int
language sql
security definer
set search_path = ''
as $$
  with d as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::int from d;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke execute on function public.rate_limit_cleanup() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.rate_limit_cleanup() to service_role;
