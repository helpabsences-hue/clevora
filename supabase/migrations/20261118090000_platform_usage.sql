-- Supabase usage, to warn Parcolia staff before the free-tier limits.
-- Platform admins and the service role only.

create table public.usage_alerts_sent (
  metric   text not null,
  level    int  not null check (level in (80, 95)),
  sent_on  date not null default current_date,
  primary key (metric, level, sent_on)
);
alter table public.usage_alerts_sent enable row level security;
-- Only the service role (daily job) reads and writes it.
create policy usage_alerts_sent_none on public.usage_alerts_sent for all to authenticated, anon using (false) with check (false);

create or replace function public.platform_usage()
returns table (
  database_bytes bigint,
  storage_bytes bigint,
  auth_users int,
  active_users_30d int,
  agencies int,
  vehicles int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_admin() then
    raise exception 'Réservé à l''équipe Parcolia' using errcode = '42501';
  end if;
  return query select
    pg_database_size(current_database())::bigint,
    coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o), 0)::bigint,
    (select count(*)::int from auth.users),
    (select count(*)::int from auth.users u where u.last_sign_in_at > now() - interval '30 days'),
    (select count(*)::int from public.agencies),
    (select count(*)::int from public.vehicles where status <> 'sold');
end;
$$;
revoke execute on function public.platform_usage() from public, anon;
grant execute on function public.platform_usage() to authenticated, service_role;
