-- /platform: one row per agency with what Parcolia needs to follow it. Parcolia staff only.
create or replace function public.platform_overview()
returns table (
  id uuid, name text, slug text, city text, created_at timestamptz,
  plan_code text, plan_name text, subscription_status text, trial_ends_at timestamptz, current_period_end timestamptz,
  writable boolean, vehicles int, members int, reservations_30d int, pending_payments int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Réservé à l''équipe Parcolia' using errcode = '42501';
  end if;
  return query
  select a.id, a.name, a.slug, a.city, a.created_at,
         p.code, p.name, a.subscription_status, a.trial_ends_at, a.current_period_end,
         public.subscription_is_writable(a.subscription_status, a.trial_ends_at, a.current_period_end),
         (select count(*)::int from public.vehicles v where v.agency_id = a.id and v.status = 'active'),
         (select count(*)::int from public.agency_members m where m.agency_id = a.id and m.status = 'active'),
         (select count(*)::int from public.reservations r where r.agency_id = a.id and r.created_at > now() - interval '30 days'),
         (select count(*)::int from public.subscription_payments s where s.agency_id = a.id and s.status = 'pending')
  from public.agencies a
  left join public.plans p on p.id = a.plan_id
  order by a.created_at desc;
end;
$$;
revoke execute on function public.platform_overview() from public, anon;
grant execute on function public.platform_overview() to authenticated, service_role;
