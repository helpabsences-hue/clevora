-- Clévora — Row Level Security on EVERY table.
-- Patterns:
--   member of the row's agency : agency_id in (select public.current_agency_ids())
--   admin of the row's agency  : agency_id in (select public.current_agency_ids(array['admin']))
-- "(select …)" makes Postgres evaluate the list once per query, not once per row.

alter table public.plans                enable row level security;
alter table public.agencies             enable row level security;
alter table public.profiles             enable row level security;
alter table public.agency_members       enable row level security;
alter table public.invitations          enable row level security;
alter table public.platform_admins      enable row level security;
alter table public.vehicles             enable row level security;
alter table public.maintenance_periods  enable row level security;
alter table public.clients              enable row level security;
alter table public.reservations         enable row level security;
alter table public.reservation_payments enable row level security;
alter table public.charges              enable row level security;
alter table public.ai_documents         enable row level security;
alter table public.ai_chunks            enable row level security;
alter table public.activity_log         enable row level security;

-- ---------------------------------------------------------------------------
-- plans: public read of active plans (pricing page); writes by platform admins
-- ---------------------------------------------------------------------------
create policy plans_select_anon on public.plans
  for select to anon using (active);
create policy plans_select on public.plans
  for select to authenticated using (active or (select public.is_platform_admin()));
create policy plans_insert on public.plans
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy plans_update on public.plans
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy plans_delete on public.plans
  for delete to authenticated using ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- agencies: members read; admins update (billing columns guarded by trigger);
-- creation only through create_agency(); no delete from the app.
-- ---------------------------------------------------------------------------
create policy agencies_select on public.agencies
  for select to authenticated
  using (id in (select public.current_agency_ids()) or (select public.is_platform_admin()));
create policy agencies_update on public.agencies
  for update to authenticated
  using      (id in (select public.current_agency_ids(array['admin'])) or (select public.is_platform_admin()))
  with check (id in (select public.current_agency_ids(array['admin'])) or (select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- profiles: yourself + people who share an agency with you
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_platform_admin())
    or exists (
      select 1 from public.agency_members m
      where m.user_id = profiles.id
        and m.agency_id in (select public.current_agency_ids())
    )
  );
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- agency_members: members read their agency's team (and their own rows);
-- admins change role/status or remove; joining only via create_agency /
-- accept_invitation (no direct insert).
-- ---------------------------------------------------------------------------
create policy members_select on public.agency_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or agency_id in (select public.current_agency_ids())
    or (select public.is_platform_admin())
  );
create policy members_update on public.agency_members
  for update to authenticated
  using      (agency_id in (select public.current_agency_ids(array['admin'])))
  with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy members_delete on public.agency_members
  for delete to authenticated
  using (agency_id in (select public.current_agency_ids(array['admin'])));

-- ---------------------------------------------------------------------------
-- invitations: admins only
-- ---------------------------------------------------------------------------
create policy invitations_select on public.invitations
  for select to authenticated
  using (agency_id in (select public.current_agency_ids(array['admin'])));
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    agency_id in (select public.current_agency_ids(array['admin']))
    and invited_by = (select auth.uid())
  );
create policy invitations_update on public.invitations
  for update to authenticated
  using      (agency_id in (select public.current_agency_ids(array['admin'])))
  with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (agency_id in (select public.current_agency_ids(array['admin'])));

-- ---------------------------------------------------------------------------
-- platform_admins: visible to platform admins; managed with SQL / service role
-- ---------------------------------------------------------------------------
create policy platform_admins_select on public.platform_admins
  for select to authenticated using ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- vehicles: members read and update (staff limited by trigger); admins add/delete
-- ---------------------------------------------------------------------------
create policy vehicles_select on public.vehicles
  for select to authenticated using (agency_id in (select public.current_agency_ids()));
create policy vehicles_insert on public.vehicles
  for insert to authenticated with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy vehicles_update on public.vehicles
  for update to authenticated
  using      (agency_id in (select public.current_agency_ids()))
  with check (agency_id in (select public.current_agency_ids()));
create policy vehicles_delete on public.vehicles
  for delete to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));

-- ---------------------------------------------------------------------------
-- maintenance_periods, clients, reservations: daily work => members; delete => admin
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['maintenance_periods','clients','reservations'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated using (agency_id in (select public.current_agency_ids()));
      create policy %1$s_insert on public.%1$I
        for insert to authenticated with check (agency_id in (select public.current_agency_ids()));
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using      (agency_id in (select public.current_agency_ids()))
        with check (agency_id in (select public.current_agency_ids()));
      create policy %1$s_delete on public.%1$I
        for delete to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- reservation_payments: members read and record; admins correct or delete
-- ---------------------------------------------------------------------------
create policy payments_select on public.reservation_payments
  for select to authenticated using (agency_id in (select public.current_agency_ids()));
create policy payments_insert on public.reservation_payments
  for insert to authenticated with check (agency_id in (select public.current_agency_ids()));
create policy payments_update on public.reservation_payments
  for update to authenticated
  using      (agency_id in (select public.current_agency_ids(array['admin'])))
  with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy payments_delete on public.reservation_payments
  for delete to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));

-- ---------------------------------------------------------------------------
-- charges: admins only (staff cannot see money)
-- ---------------------------------------------------------------------------
create policy charges_select on public.charges
  for select to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));
create policy charges_insert on public.charges
  for insert to authenticated with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy charges_update on public.charges
  for update to authenticated
  using      (agency_id in (select public.current_agency_ids(array['admin'])))
  with check (agency_id in (select public.current_agency_ids(array['admin'])));
create policy charges_delete on public.charges
  for delete to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));

-- ---------------------------------------------------------------------------
-- ai_documents, ai_chunks: members read (assistant); admins manage
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ai_documents','ai_chunks'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated using (agency_id in (select public.current_agency_ids()));
      create policy %1$s_insert on public.%1$I
        for insert to authenticated with check (agency_id in (select public.current_agency_ids(array['admin'])));
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using      (agency_id in (select public.current_agency_ids(array['admin'])))
        with check (agency_id in (select public.current_agency_ids(array['admin'])));
      create policy %1$s_delete on public.%1$I
        for delete to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- activity_log: members insert as themselves; admins read; no update/delete
-- ---------------------------------------------------------------------------
create policy activity_log_select on public.activity_log
  for select to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));
create policy activity_log_insert on public.activity_log
  for insert to authenticated
  with check (
    agency_id in (select public.current_agency_ids())
    and actor_id = (select auth.uid())
  );

revoke update, delete on public.activity_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- TRUNCATE ignores RLS: never allow it for API roles.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
