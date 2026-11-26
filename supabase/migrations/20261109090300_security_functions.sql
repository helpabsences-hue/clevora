-- Clévora — security helper functions used by RLS policies.
-- SECURITY DEFINER so they can read agency_members without recursive RLS;
-- search_path is empty so nothing can be hijacked; every name is qualified.

-- All agencies where the current user is an ACTIVE member with one of p_roles.
-- Policies use: agency_id in (select public.current_agency_ids())
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
    and m.role = any (p_roles);
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
  );
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
  );
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
  );
$$;

revoke execute on function public.current_agency_ids(text[]) from public, anon;
revoke execute on function public.is_member(uuid)            from public, anon;
revoke execute on function public.has_role(uuid, text[])     from public, anon;
revoke execute on function public.is_platform_admin()        from public, anon;
grant  execute on function public.current_agency_ids(text[]) to authenticated, service_role;
grant  execute on function public.is_member(uuid)            to authenticated, service_role;
grant  execute on function public.has_role(uuid, text[])     to authenticated, service_role;
grant  execute on function public.is_platform_admin()        to authenticated, service_role;
