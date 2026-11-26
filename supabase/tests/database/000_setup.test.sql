-- Test helpers (committed, so every following test file can use them).
-- Each test file then runs inside a transaction that is rolled back.

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Fixed ids for the fixture: '<who>_<what>'
--   a_* = Agence A, b_* = Agence B, c_outsider = user without agency, e_platform = Parcolia staff
create or replace function tests.id(p_name text)
returns uuid
language sql
immutable
as $$
  select (
    case split_part(p_name, '_', 1)
      when 'a' then 'aaaaaaaa' when 'b' then 'bbbbbbbb'
      when 'c' then 'cccccccc' when 'e' then 'eeeeeeee'
    end
    || '-0000-4000-8000-' ||
    case split_part(p_name, '_', 2)
      when 'agency'      then '000000000000'
      when 'admin'       then '0000000000a1'
      when 'staff'       then '0000000000a2'
      when 'outsider'    then '0000000000c1'
      when 'platform'    then '0000000000e1'
      when 'vehicle'     then '000000000101'
      when 'client'      then '000000000102'
      when 'client2'     then '000000000103'
      when 'reservation' then '000000000104'
      when 'payment'     then '000000000105'
      when 'charge'      then '000000000106'
      when 'maintenance' then '000000000107'
      when 'doc'         then '000000000108'
      when 'chunk'       then '000000000109'
      when 'invitation'  then '00000000010a'
      when 'subpay'      then '00000000010b'
      when 'booking'     then '00000000010c'
      when 'oil'         then '00000000010d'
      when 'finance'     then '00000000010e'
      when 'inspection'  then '00000000010f'
      when 'inphoto'     then '000000000110'
      when 'indamage'    then '000000000111'
    end
  )::uuid
$$;

-- Every table that holds agency data, with the column that names the agency.
-- Test 001 fails if a table with agency_id is missing here.
create or replace function tests.tenant_tables()
returns table (name text, col text)
language sql
immutable
as $$
  values ('agencies','id'), ('agency_members','agency_id'), ('invitations','agency_id'),
         ('vehicles','agency_id'), ('maintenance_periods','agency_id'), ('clients','agency_id'),
         ('reservations','agency_id'), ('reservation_payments','agency_id'), ('charges','agency_id'),
         ('ai_documents','agency_id'), ('ai_chunks','agency_id'), ('activity_log','agency_id'),
         ('subscription_payments','agency_id'), ('booking_requests','agency_id'),
         ('oil_changes','agency_id'), ('vehicle_finance','agency_id'),
         ('inspections','agency_id'), ('inspection_photos','agency_id'), ('inspection_damages','agency_id')
$$;

-- Act as a logged-in user (like PostgREST does with the JWT)
create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Rows of p_table for p_agency visible to the current role
create or replace function tests.count_rows(p_table text, p_col text, p_agency uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute format('select count(*) from public.%I where %I = $1', p_table, p_col) into n using p_agency;
  return n;
end;
$$;

-- Rows changed by an UPDATE / DELETE attempt (0 when RLS or privileges stop it)
create or replace function tests.update_rows(p_table text, p_col text, p_agency uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute format(
    'with u as (update public.%I set updated_at = now() where %I = $1 returning 1) select count(*) from u',
    p_table, p_col) into n using p_agency;
  return n;
exception when insufficient_privilege then
  return 0;
end;
$$;

create or replace function tests.delete_rows(p_table text, p_col text, p_agency uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute format(
    'with d as (delete from public.%I where %I = $1 returning 1) select count(*) from d',
    p_table, p_col) into n using p_agency;
  return n;
exception when insufficient_privilege then
  return 0;
end;
$$;

-- Try to insert a valid row for p_agency into p_table; returns 'ok' or the SQLSTATE.
create or replace function tests.try_insert(p_table text, p_agency uuid)
returns text
language plpgsql
as $$
declare
  x text := case when p_agency = tests.id('a_agency') then 'a' else 'b' end;
begin
  case p_table
    when 'agencies' then
      insert into public.agencies (name, slug) values ('Pirate', 'pirate-' || substr(md5(random()::text), 1, 8));
    when 'agency_members' then
      insert into public.agency_members (agency_id, user_id, role)
      values (p_agency, coalesce(auth.uid(), tests.id('c_outsider')), 'admin');
    when 'invitations' then
      insert into public.invitations (agency_id, email, role, token_hash, invited_by)
      values (p_agency, 'pirate@test.ma', 'admin', md5(random()::text) || md5(random()::text), auth.uid());
    when 'vehicles' then
      insert into public.vehicles (agency_id, plate, brand_model, category, fuel, gearbox, daily_rate)
      values (p_agency, 'PIRATE-' || substr(md5(random()::text), 1, 6), 'Test', 'economy', 'diesel', 'manuelle', 100);
    when 'maintenance_periods' then
      insert into public.maintenance_periods (agency_id, vehicle_id, reason)
      values (p_agency, tests.id(x || '_vehicle'), 'panne');
    when 'clients' then
      insert into public.clients (agency_id, full_name, id_type, id_number)
      values (p_agency, 'Pirate', 'cin', 'PIR' || substr(md5(random()::text), 1, 6));
    when 'reservations' then
      insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
      values (p_agency, tests.id(x || '_vehicle'), tests.id(x || '_client'),
              now() + interval '200 days', now() + interval '202 days', 100);
    when 'reservation_payments' then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
      values (p_agency, tests.id(x || '_reservation'), 100, 'cash', 'extra');
    when 'charges' then
      insert into public.charges (agency_id, category, amount) values (p_agency, 'autre', 100);
    when 'ai_documents' then
      insert into public.ai_documents (agency_id, title) values (p_agency, 'Pirate');
    when 'ai_chunks' then
      insert into public.ai_chunks (agency_id, document_id, content)
      values (p_agency, tests.id(x || '_doc'), 'pirate');
    when 'activity_log' then
      insert into public.activity_log (agency_id, actor_id, action, entity)
      values (p_agency, auth.uid(), 'pirate', 'pirate');
    when 'subscription_payments' then
      insert into public.subscription_payments (agency_id, plan_id, period, amount, method, reference, status, invoice_number, paid_at)
      values (p_agency, (select id from public.plans where code = 'illimite'), 'year', 0, 'virement',
              'PIRATE-' || substr(md5(random()::text), 1, 6), 'paid', 'F-PIRATE-' || substr(md5(random()::text), 1, 6), now());
    when 'booking_requests' then
      insert into public.booking_requests (agency_id, full_name, phone, start_date, end_date)
      values (p_agency, 'Pirate', '0600000000', current_date + 1, current_date + 2);
    when 'oil_changes' then
      insert into public.oil_changes (agency_id, vehicle_id, km) values (p_agency, tests.id(x || '_vehicle'), 1000);
    when 'vehicle_finance' then
      insert into public.vehicle_finance (agency_id, vehicle_id, purchase_date, purchase_price, mode)
      values (p_agency, tests.id(x || '_vehicle'), current_date, 100000, 'cash');
    when 'inspections' then
      insert into public.inspections (agency_id, reservation_id, kind)
      values (p_agency, tests.id(x || '_reservation'), 'return');
    when 'inspection_photos' then
      insert into public.inspection_photos (agency_id, inspection_id, view, storage_path)
      values (p_agency, tests.id(x || '_inspection'), 'back', p_agency::text || '/inspections/x/back.jpg');
    when 'inspection_damages' then
      insert into public.inspection_damages (agency_id, inspection_id, x, y, type)
      values (p_agency, tests.id(x || '_inspection'), 0.5, 0.5, 'dent');
    else
      raise exception 'unknown table %', p_table;
  end case;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

-- Fingerprint of ALL data of one agency (tables + storage). Run as superuser.
create or replace function tests.agency_fingerprint(p_agency uuid)
returns text
language plpgsql
as $$
declare
  t   record;
  acc text := '';
  h   text;
begin
  for t in select * from tests.tenant_tables() loop
    execute format(
      'select md5(coalesce(string_agg(to_jsonb(x)::text, %L order by x.id), %L)) from public.%I x where %I = $1',
      '|', '-', t.name, t.col) into h using p_agency;
    acc := acc || t.name || ':' || h || ';';
  end loop;
  select md5(coalesce(string_agg(bucket_id || '/' || name || '/' || coalesce(metadata::text, ''), '|' order by bucket_id, name), '-'))
    into h from storage.objects where name like p_agency::text || '/%';
  return md5(acc || 'storage:' || h);
end;
$$;

-- Two agencies with one row in every table, two users each, an outsider and a
-- Parcolia platform admin. Run as superuser at the start of a test file.
create or replace function tests.create_fixture()
returns void
language plpgsql
as $$
declare
  x text;
  v_agency uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (tests.id('a_admin'),    'a.admin@test.ma',  '{"full_name":"Admin A"}'),
    (tests.id('a_staff'),    'a.staff@test.ma',  '{"full_name":"Staff A"}'),
    (tests.id('b_admin'),    'b.admin@test.ma',  '{"full_name":"Admin B"}'),
    (tests.id('b_staff'),    'b.staff@test.ma',  '{"full_name":"Staff B"}'),
    (tests.id('c_outsider'), 'outsider@test.ma', '{"full_name":"Outsider"}'),
    (tests.id('e_platform'), 'platform@parcolia.ma', '{"full_name":"Parcolia"}');

  insert into public.platform_admins (user_id) values (tests.id('e_platform'));

  foreach x in array array['a','b'] loop
    v_agency := tests.id(x || '_agency');

    insert into public.agencies (id, name, slug, plan_id, subscription_status, trial_ends_at)
    values (v_agency, 'Agence ' || upper(x), 'agence-test-' || x,
            (select id from public.plans where code = 'pro'), 'trial', now() + interval '14 days');

    insert into public.agency_members (agency_id, user_id, role) values
      (v_agency, tests.id(x || '_admin'), 'admin'),
      (v_agency, tests.id(x || '_staff'), 'staff');

    insert into public.vehicles (id, agency_id, plate, brand_model, category, fuel, gearbox, daily_rate, current_km)
    values (tests.id(x || '_vehicle'), v_agency, '1000' || x || '-A-6', 'Dacia Logan', 'economy', 'diesel', 'manuelle', 250, 50000);

    insert into public.clients (id, agency_id, full_name, phone, id_type, id_number) values
      (tests.id(x || '_client'),  v_agency, 'Client ' || x, '+212600000000', 'cin', 'TT' || x || '1001'),
      (tests.id(x || '_client2'), v_agency, 'Client 2 ' || x, '+212600000001', 'cin', 'TT' || x || '1002');

    insert into public.reservations (id, agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
    values (tests.id(x || '_reservation'), v_agency, tests.id(x || '_vehicle'), tests.id(x || '_client'),
            date_trunc('day', now()) + interval '10 days', date_trunc('day', now()) + interval '13 days', 250);

    insert into public.reservation_payments (id, agency_id, reservation_id, amount, method, kind)
    values (tests.id(x || '_payment'), v_agency, tests.id(x || '_reservation'), 200, 'cash', 'advance');

    insert into public.charges (id, agency_id, category, vehicle_id, amount)
    values (tests.id(x || '_charge'), v_agency, 'lavage', tests.id(x || '_vehicle'), 60);

    insert into public.maintenance_periods (id, agency_id, vehicle_id, reason, starts_on, expected_end_on, ended_on)
    values (tests.id(x || '_maintenance'), v_agency, tests.id(x || '_vehicle'), 'entretien',
            current_date - 30, current_date - 29, current_date - 29);

    insert into public.ai_documents (id, agency_id, title, storage_path)
    values (tests.id(x || '_doc'), v_agency, 'Règlement ' || x, v_agency::text || '/ai/reglement.pdf');

    insert into public.subscription_payments (id, agency_id, plan_id, period, amount, method, reference)
    values (tests.id(x || '_subpay'), v_agency, (select id from public.plans where code = 'pro'), 'month', 599, 'virement', 'PAR-TEST' || upper(x));

    insert into public.booking_requests (id, agency_id, vehicle_id, full_name, phone, start_date, end_date)
    values (tests.id(x || '_booking'), v_agency, tests.id(x || '_vehicle'), 'Web ' || x, '+212600000010', current_date + 10, current_date + 12);

    insert into public.oil_changes (id, agency_id, vehicle_id, date, km, next_km, items)
    values (tests.id(x || '_oil'), v_agency, tests.id(x || '_vehicle'), current_date - 40, 20000, 30000, array['huile','filtre_huile']);

    insert into public.vehicle_finance (id, agency_id, vehicle_id, purchase_date, purchase_price, mode, down_payment, monthly_payment, months, first_payment_on)
    values (tests.id(x || '_finance'), v_agency, tests.id(x || '_vehicle'), current_date - 400, 150000, 'credit', 30000, 3000, 48, current_date - 370);

    insert into public.inspections (id, agency_id, reservation_id, kind, completed_at)
    values (tests.id(x || '_inspection'), v_agency, tests.id(x || '_reservation'), 'departure', now());
    insert into public.inspection_photos (id, agency_id, inspection_id, view, storage_path)
    values (tests.id(x || '_inphoto'), v_agency, tests.id(x || '_inspection'), 'front', v_agency::text || '/inspections/' || tests.id(x || '_inspection') || '/front.jpg');
    insert into public.inspection_damages (id, agency_id, inspection_id, x, y, type, view)
    values (tests.id(x || '_indamage'), v_agency, tests.id(x || '_inspection'), 0.3, 0.2, 'scratch', 'front');

    insert into public.ai_chunks (id, agency_id, document_id, content, embedding)
    values (tests.id(x || '_chunk'), v_agency, tests.id(x || '_doc'), 'Caution de l''agence ' || x,
            array_fill(case when x = 'a' then 0.01 else -0.01 end::real, array[1536])::extensions.vector);

    insert into public.invitations (id, agency_id, email, role, token_hash, invited_by)
    values (tests.id(x || '_invitation'), v_agency,
            case when x = 'a' then 'outsider@test.ma' else 'someone@test.ma' end, 'staff',
            encode(sha256(convert_to('token-' || x, 'UTF8')), 'hex'), tests.id(x || '_admin'));

    insert into storage.objects (bucket_id, name, metadata) values
      ('agency-docs',  v_agency::text || '/contrats/contrat-1.pdf', '{"size":1}'),
      ('agency-docs',  v_agency::text || '/charges/recu-1.jpg',     '{"size":1}'),
      ('agency-logos', v_agency::text || '/logo.png',                '{"size":1}');
  end loop;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select pass('test helpers installed');
select * from finish();
