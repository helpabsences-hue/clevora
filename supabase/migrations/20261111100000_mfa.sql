-- Two-step login: when a user has turned it on (a verified TOTP factor), the
-- database only opens their agencies once the session is AAL2 (code entered).
-- Without this, someone with the password alone could query the API directly.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;
revoke execute on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated, service_role;

create or replace function public.current_agency_ids(p_roles text[] default array['admin','staff'])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.agency_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role = any (p_roles)
    and (select public.mfa_satisfied());
$$;

create or replace function public.is_member(p_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = p_agency
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  ) and (select public.mfa_satisfied());
$$;

create or replace function public.has_role(p_agency uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = p_agency
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  ) and (select public.mfa_satisfied());
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins p
    where p.user_id = (select auth.uid())
  ) and (select public.mfa_satisfied());
$$;

create or replace function public.writable_agency_ids(p_roles text[] default array['admin','staff'])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.agency_members m
  join public.agencies a on a.id = m.agency_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role = any (p_roles)
    and public.subscription_is_writable(a.subscription_status, a.trial_ends_at, a.current_period_end)
    and (select public.mfa_satisfied());
$$;
