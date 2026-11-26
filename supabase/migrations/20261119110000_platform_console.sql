-- Parcolia owner console (/platform): business numbers, every account, agency
-- activity, Parcolia admins. Parcolia staff only. Counts, never the agencies'
-- client personal data (loi 09-08: Parcolia is only the processor).

create or replace function public._assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_platform_admin() then
    raise exception 'Réservé à l''équipe Parcolia' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public._assert_platform_admin() from public, anon;
grant execute on function public._assert_platform_admin() to authenticated, service_role;

/** Whole-platform numbers for the dashboard (one JSON object). */
create or replace function public.platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Africa/Casablanca'))::date;
  v_result jsonb;
begin
  perform public._assert_platform_admin();
  with a as (
    select ag.*, public.subscription_is_writable(ag.subscription_status, ag.trial_ends_at, ag.current_period_end) as writable,
           p.price_mad_month, p.price_mad_year, p.name as plan_name
    from public.agencies ag left join public.plans p on p.id = ag.plan_id
  ),
  -- Monthly recurring revenue: active agencies, at the price of their last paid period
  last_paid as (
    select distinct on (sp.agency_id) sp.agency_id, sp.period, sp.amount
    from public.subscription_payments sp where sp.status = 'paid'
    order by sp.agency_id, sp.paid_at desc
  ),
  months as (
    select (v_month - make_interval(months => g))::date as m from generate_series(0, 11) g
  )
  select jsonb_build_object(
    'agencies', (select count(*) from a),
    'trial', (select count(*) from a where subscription_status = 'trial' and writable),
    'active', (select count(*) from a where subscription_status = 'active' and writable),
    'past_due', (select count(*) from a where subscription_status = 'past_due'),
    'suspended', (select count(*) from a where subscription_status = 'suspended'),
    'cancelled', (select count(*) from a where subscription_status = 'cancelled'),
    'read_only', (select count(*) from a where not writable),
    'new_this_month', (select count(*) from a where created_at >= v_month),
    'mrr', coalesce((select sum(case when lp.period = 'year' then lp.amount / 12 else lp.amount end)
                     from a join last_paid lp on lp.agency_id = a.id
                     where a.subscription_status = 'active' and a.writable), 0),
    'collected_this_month', coalesce((select sum(amount) from public.subscription_payments
                                      where status = 'paid' and paid_at >= v_month), 0),
    'vehicles', (select count(*) from public.vehicles where status = 'active'),
    'users', (select count(*) from auth.users),
    'active_users_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'reservations_30d', (select count(*) from public.reservations where created_at > now() - interval '30 days'),
    'reservations_total', (select count(*) from public.reservations),
    'ai_questions_month', (select count(*) from public.activity_log where action = 'assistant.question' and created_at >= v_month),
    'pending_payments', (select count(*) from public.subscription_payments where status = 'pending'),
    'by_month', (
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m.m, 'YYYY-MM'),
        'new_agencies', (select count(*) from a where a.created_at >= m.m and a.created_at < m.m + interval '1 month'),
        'collected', coalesce((select sum(sp.amount) from public.subscription_payments sp
                               where sp.status = 'paid' and sp.paid_at >= m.m and sp.paid_at < m.m + interval '1 month'), 0)
      ) order by m.m)
      from months m
    ),
    'trials_ending', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'city', city, 'ends', trial_ends_at) order by trial_ends_at)
      from a where subscription_status = 'trial' and trial_ends_at between now() - interval '3 days' and now() + interval '7 days'
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.platform_stats() from public, anon;
grant execute on function public.platform_stats() to authenticated, service_role;

/** Every account: agencies and roles, last login, two-step login, Parcolia admin. */
create or replace function public.platform_users()
returns table (
  id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed boolean, mfa boolean, platform_admin boolean, agencies jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._assert_platform_admin();
  return query
  select u.id, u.email::text, coalesce(p.full_name, ''), u.created_at, u.last_sign_in_at,
         u.email_confirmed_at is not null,
         exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
         exists (select 1 from public.platform_admins pa where pa.user_id = u.id),
         coalesce((select jsonb_agg(jsonb_build_object('id', ag.id, 'name', ag.name, 'role', m.role, 'status', m.status) order by ag.name)
                   from public.agency_members m join public.agencies ag on ag.id = m.agency_id
                   where m.user_id = u.id), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;
revoke execute on function public.platform_users() from public, anon;
grant execute on function public.platform_users() to authenticated, service_role;

/** One agency's activity (counts only) for its page in /platform. */
create or replace function public.platform_agency_activity(p_agency uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Africa/Casablanca'))::date;
begin
  perform public._assert_platform_admin();
  return jsonb_build_object(
    'clients', (select count(*) from public.clients where agency_id = p_agency),
    'reservations_total', (select count(*) from public.reservations where agency_id = p_agency),
    'contracts_month', (select count(*) from public.reservations where agency_id = p_agency and start_at >= v_month and status <> 'cancelled'),
    'ai_questions_month', (select count(*) from public.activity_log where agency_id = p_agency and action = 'assistant.question' and created_at >= v_month),
    'last_activity', (select max(created_at) from public.activity_log where agency_id = p_agency),
    'last_login', (select max(u.last_sign_in_at) from auth.users u join public.agency_members m on m.user_id = u.id where m.agency_id = p_agency),
    'by_month', (
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m.m, 'YYYY-MM'),
        'reservations', (select count(*) from public.reservations r where r.agency_id = p_agency and r.created_at >= m.m and r.created_at < m.m + interval '1 month')
      ) order by m.m)
      from (select (v_month - make_interval(months => g))::date as m from generate_series(0, 5) g) m
    )
  );
end;
$$;
revoke execute on function public.platform_agency_activity(uuid) from public, anon;
grant execute on function public.platform_agency_activity(uuid) to authenticated, service_role;

/**
 * Give or remove Parcolia admin access (by email; the account must exist).
 * Nobody can remove themselves, and the last Parcolia admin always stays.
 */
create or replace function public.platform_set_admin(p_email text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform public._assert_platform_admin();
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'Aucun compte avec cet e-mail' using errcode = 'P0002', hint = 'no_account';
  end if;
  if p_on then
    insert into public.platform_admins (user_id) values (v_user) on conflict (user_id) do nothing;
  else
    if v_user = auth.uid() then
      raise exception 'Vous ne pouvez pas retirer votre propre accès' using errcode = 'P0001', hint = 'self_change';
    end if;
    if (select count(*) from public.platform_admins) <= 1 then
      raise exception 'Il faut garder au moins un admin Parcolia' using errcode = 'P0001', hint = 'last_platform_admin';
    end if;
    delete from public.platform_admins where user_id = v_user;
  end if;
end;
$$;
revoke execute on function public.platform_set_admin(text, boolean) from public, anon;
grant execute on function public.platform_set_admin(text, boolean) to authenticated, service_role;
