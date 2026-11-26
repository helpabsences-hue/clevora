-- Clévora — triggers: updated_at, guards, contract numbers, payments sync, activity log, profiles.

-- ---------------------------------------------------------------------------
-- updated_at (+ immutable agency_id) on every table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'plans','agencies','profiles','agency_members','invitations','platform_admins',
    'vehicles','maintenance_periods','clients','reservations','reservation_payments',
    'charges','ai_documents','ai_chunks','activity_log'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- New auth user => profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, preferred_locale)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    case when new.raw_user_meta_data ->> 'locale' in ('fr','ar','en')
         then new.raw_user_meta_data ->> 'locale' else 'fr' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- agencies: billing fields can only be changed by Clévora (platform admins,
-- server code with the service role, or SECURITY DEFINER functions).
-- ---------------------------------------------------------------------------
create or replace function public.tg_agencies_protect_billing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.plan_id, new.subscription_status, new.trial_ends_at, new.current_period_end)
       is distinct from
     (old.plan_id, old.subscription_status, old.trial_ends_at, old.current_period_end)
     and current_user in ('authenticated', 'anon')
     and not public.is_platform_admin() then
    raise exception 'Seule l''équipe Clévora peut modifier le forfait ou l''abonnement'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_billing before update on public.agencies
  for each row execute function public.tg_agencies_protect_billing();

-- ---------------------------------------------------------------------------
-- agency_members: nobody changes their own role/status; the last active
-- admin can never be removed, disabled or demoted.
-- ---------------------------------------------------------------------------
create or replace function public.tg_members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and current_user in ('authenticated', 'anon')
     and old.user_id = (select auth.uid())
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle ou statut'
      using errcode = '42501';
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.status <> 'active') then
    -- serialise concurrent changes on the same agency
    perform pg_advisory_xact_lock(hashtext('agency_admins:' || old.agency_id::text));

    -- agency being deleted (cascade): nothing to protect
    if not exists (select 1 from public.agencies a where a.id = old.agency_id) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    if not exists (
      select 1 from public.agency_members m
      where m.agency_id = old.agency_id
        and m.id <> old.id
        and m.role = 'admin'
        and m.status = 'active'
    ) then
      raise exception 'L''agence doit garder au moins un administrateur actif'
        using errcode = 'P0001', hint = 'last_admin';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger members_guard before update or delete on public.agency_members
  for each row execute function public.tg_members_guard();

-- ---------------------------------------------------------------------------
-- vehicles: staff may only change km, vidange, assurance, visite and notes
-- ---------------------------------------------------------------------------
create or replace function public.tg_vehicles_staff_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_allowed text[] := array[
    'current_km','insurer','policy_number','insurance_expires_on','technical_visit_expires_on',
    'oil_last_km','oil_last_date','oil_next_km','notes','updated_at',
    -- generated column: not computed yet in BEFORE triggers; derived from plate (which is checked)
    'plate_norm'
  ];
begin
  if current_user in ('authenticated', 'anon')
     and not public.has_role(new.agency_id, array['admin'])
     and (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'Le personnel peut seulement modifier le kilométrage, la vidange, l''assurance, la visite technique et les notes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger staff_guard before update on public.vehicles
  for each row execute function public.tg_vehicles_staff_guard();

-- ---------------------------------------------------------------------------
-- vehicles: plan limit (max_vehicles active cars; null = unlimited)
-- ---------------------------------------------------------------------------
create or replace function public.tg_vehicles_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   int;
  v_count int;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  select p.max_vehicles into v_max
  from public.agencies a left join public.plans p on p.id = a.plan_id
  where a.id = new.agency_id
  for update of a;

  if v_max is not null then
    select count(*) into v_count
    from public.vehicles v
    where v.agency_id = new.agency_id and v.status = 'active';
    if v_count >= v_max then
      raise exception 'Votre forfait permet % voitures. Passez à un forfait supérieur pour en ajouter.', v_max
        using errcode = 'P0001', hint = 'plan_limit_vehicles';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_vehicles_plan_limit() from public, anon, authenticated;

create trigger plan_limit before insert or update of status on public.vehicles
  for each row execute function public.tg_vehicles_plan_limit();

-- ---------------------------------------------------------------------------
-- reservations: empty contract number => next_contract_number()
-- ---------------------------------------------------------------------------
create or replace function public.tg_reservations_contract_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.contract_number := nullif(btrim(new.contract_number), '');
  if new.contract_number is null then
    if tg_op = 'UPDATE' then
      new.contract_number := old.contract_number;
    else
      new.contract_number := public._next_contract_number(new.agency_id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_reservations_contract_number() from public, anon, authenticated;

create trigger contract_number before insert or update of contract_number on public.reservations
  for each row execute function public.tg_reservations_contract_number();

-- ---------------------------------------------------------------------------
-- reservation_payments => reservations.advance_paid = sum of 'advance' payments
-- ---------------------------------------------------------------------------
create or replace function public.tg_payments_sync_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.reservation_id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.reservation_id];
  else
    v_ids := array[new.reservation_id, old.reservation_id];
  end if;

  update public.reservations r
     set advance_paid = coalesce((
           select sum(p.amount) from public.reservation_payments p
           where p.reservation_id = r.id and p.kind = 'advance'), 0)
   where r.id = any (v_ids);
  return null;
end;
$$;
revoke execute on function public.tg_payments_sync_advance() from public, anon, authenticated;

create trigger sync_advance after insert or update or delete on public.reservation_payments
  for each row execute function public.tg_payments_sync_advance();

-- ---------------------------------------------------------------------------
-- activity_log writer for reservations, vehicles, charges, agency_members
-- ---------------------------------------------------------------------------
create or replace function public.tg_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     jsonb;
  v_old     jsonb;
  v_agency  uuid;
  v_entity  text;
  v_action  text;
  v_details jsonb;
  v_changes jsonb := '{}'::jsonb;
  k         text;
begin
  v_entity := case tg_table_name
                when 'reservations'   then 'reservation'
                when 'vehicles'       then 'vehicle'
                when 'charges'        then 'charge'
                when 'agency_members' then 'member'
                else tg_table_name
              end;

  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_agency := (v_row ->> 'agency_id')::uuid;

  -- agency being deleted (cascade): nothing to log
  if not exists (select 1 from public.agencies a where a.id = v_agency) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action  := v_entity || '.created';
    v_details := jsonb_build_object('new', v_row);
  elsif tg_op = 'DELETE' then
    v_action  := v_entity || '.deleted';
    v_details := jsonb_build_object('old', v_row);
  else
    v_old := to_jsonb(old);
    for k in select jsonb_object_keys(v_row) loop
      if k <> 'updated_at' and (v_row -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_row -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;

    v_action := v_entity || '.updated';
    if tg_table_name = 'reservations' then
      if v_changes ? 'status' then
        v_action := 'reservation.' || (v_row ->> 'status');      -- reservation.on_rental / returned / cancelled
      elsif v_changes ? 'signed_at' and (v_row ->> 'signed_at') is not null then
        v_action := 'contract.signed';
      end if;
    end if;
    v_details := jsonb_build_object('changes', v_changes);
  end if;

  insert into public.activity_log (agency_id, actor_id, action, entity, entity_id, details)
  values (v_agency, (select auth.uid()), v_action, v_entity, (v_row ->> 'id')::uuid, v_details);

  return null;
end;
$$;
revoke execute on function public.tg_activity_log() from public, anon, authenticated;

create trigger activity_log after insert or update or delete on public.reservations
  for each row execute function public.tg_activity_log();
create trigger activity_log after insert or update or delete on public.vehicles
  for each row execute function public.tg_activity_log();
create trigger activity_log after insert or update or delete on public.charges
  for each row execute function public.tg_activity_log();
create trigger activity_log after insert or update or delete on public.agency_members
  for each row execute function public.tg_activity_log();

-- ---------------------------------------------------------------------------
-- activity_log is insert-only (rows disappear only when their agency is deleted)
-- ---------------------------------------------------------------------------
create or replace function public.tg_activity_log_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.agencies a where a.id = old.agency_id) then
    return old;
  end if;
  raise exception 'Le journal d''activité ne peut pas être modifié' using errcode = '42501';
end;
$$;
revoke execute on function public.tg_activity_log_immutable() from public, anon, authenticated;

create trigger immutable before update or delete on public.activity_log
  for each row execute function public.tg_activity_log_immutable();
