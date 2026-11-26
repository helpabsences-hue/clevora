-- Business rules enforced by the database.
begin;
set local search_path = public, extensions, tests;
select plan(32);

select tests.create_fixture();

-- Fixture: car a_vehicle is booked from day+10 to day+13 (contract C-1).

-- ===========================================================================
-- Double booking
-- ===========================================================================
select tests.authenticate_as(tests.id('a_staff'));

select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client2'),
             date_trunc('day', now()) + interval '12 days', date_trunc('day', now()) + interval '15 days', 250) $$,
  '23P01', null, 'double booking of the same car is refused');

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client2'),
             date_trunc('day', now()) + interval '13 days', date_trunc('day', now()) + interval '15 days', 250) $$,
  'a booking that starts exactly when the previous one ends is accepted');

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price, status, contract_number)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client2'),
             date_trunc('day', now()) + interval '11 days', date_trunc('day', now()) + interval '12 days', 250,
             'cancelled', 'ANNULE-1') $$,
  'a cancelled reservation does not block the car');

select throws_ok(
  $$ update public.reservations set status = 'reserved' where contract_number = 'ANNULE-1' $$,
  '23P01', null, 're-activating a cancelled reservation over another booking is refused');

-- ===========================================================================
-- Contract numbers (fixture used C-1 and the adjacent booking above took C-2)
-- ===========================================================================
select is(public.preview_contract_number(tests.id('a_agency')), 'C-3', 'preview shows the next number');
select is(public.preview_contract_number(tests.id('a_agency')), 'C-3', 'preview does not consume the number');

insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
        date_trunc('day', now()) + interval '20 days', date_trunc('day', now()) + interval '21 days', 250, '');
select is(
  (select contract_number from public.reservations
    where agency_id = tests.id('a_agency') and start_at = date_trunc('day', now()) + interval '20 days'),
  'C-3', 'an empty contract number gets the next number automatically');

insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
        date_trunc('day', now()) + interval '22 days', date_trunc('day', now()) + interval '23 days', 250, 'C-4');
insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
        date_trunc('day', now()) + interval '24 days', date_trunc('day', now()) + interval '25 days', 250);
select is(
  (select contract_number from public.reservations
    where agency_id = tests.id('a_agency') and start_at = date_trunc('day', now()) + interval '24 days'),
  'C-5', 'automatic numbering skips a number already typed by hand (C-4)');

select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             date_trunc('day', now()) + interval '30 days', date_trunc('day', now()) + interval '31 days', 250, 'C-1') $$,
  '23505', null, 'a contract number already used in the agency is refused');

select is(public.next_contract_number(tests.id('a_agency')), 'C-6', 'next_contract_number() returns and consumes a number');
select is(public.preview_contract_number(tests.id('a_agency')), 'C-7', 'the counter moved forward');

-- Agency B numbering is independent (B also has C-1 from the fixture)
reset role;
select is(
  (select count(*)::int from public.reservations where contract_number = 'C-1' and agency_id in (tests.id('a_agency'), tests.id('b_agency'))), 2,
  'two agencies can both have contract C-1');

-- ===========================================================================
-- Payments keep reservations.advance_paid in sync
-- ===========================================================================
select tests.authenticate_as(tests.id('a_staff'));
insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
values (tests.id('a_agency'), tests.id('a_reservation'), 300, 'card', 'advance');
select is(
  (select advance_paid from public.reservations where id = tests.id('a_reservation')), 500.00::numeric,
  'advance_paid = sum of advance payments (200 + 300)');

-- ===========================================================================
-- Activity log
-- ===========================================================================
update public.reservations set status = 'on_rental', signed_at = now(), km_out = 50000, fuel_out = 4
 where id = tests.id('a_reservation');
reset role;
select ok(
  exists (select 1 from public.activity_log
           where entity_id = tests.id('a_reservation') and action = 'reservation.on_rental'
             and actor_id = tests.id('a_staff')),
  'starting a rental is logged with who did it');
select ok(
  exists (select 1 from public.activity_log where entity_id = tests.id('a_reservation') and action = 'reservation.created'),
  'creating a reservation is logged');

-- ===========================================================================
-- Normalised matricule and CIN
-- ===========================================================================
select is((select plate_norm from public.vehicles where id = tests.id('a_vehicle')), '1000AA6',
          'matricule is normalised (uppercase, no spaces/dashes)');
select throws_ok(
  $$ insert into public.vehicles (agency_id, plate, brand_model, category, fuel, gearbox, daily_rate)
     values (tests.id('a_agency'), '1000 a a 6', 'Doublon', 'economy', 'diesel', 'manuelle', 100) $$,
  '23505', null, 'the same matricule written differently is refused as a duplicate');
select is(
  (select id_number_norm from public.clients where id = tests.id('a_client')), 'TTA1001',
  'CIN is normalised');
select throws_ok(
  $$ insert into public.clients (agency_id, full_name, id_type, id_number)
     values (tests.id('a_agency'), 'Doublon', 'cin', 'tt-a 1001') $$,
  '23505', null, 'the same CIN written differently is refused as a duplicate');
select lives_ok(
  $$ insert into public.clients (agency_id, full_name, id_type, id_number)
     values (tests.id('b_agency'), 'Même CIN autre agence', 'cin', 'TTA1001') $$,
  'another agency can have its own client with the same CIN (clients are never shared)');

-- ===========================================================================
-- Last admin
-- ===========================================================================
select tests.authenticate_as(tests.id('a_admin'));
select throws_ok(
  $$ delete from public.agency_members where user_id = tests.id('a_admin') and agency_id = tests.id('a_agency') $$,
  'P0001', null, 'the last admin cannot leave the agency');
select lives_ok(
  $$ update public.agency_members set role = 'admin' where user_id = tests.id('a_staff') $$,
  'an admin can promote staff to admin');
select tests.authenticate_as(tests.id('a_staff'));
select lives_ok(
  $$ update public.agency_members set role = 'staff' where user_id = tests.id('a_admin') $$,
  'with two admins, one can be demoted');
reset role;
select throws_ok(
  $$ update public.agency_members set status = 'disabled' where user_id = tests.id('a_staff') and agency_id = tests.id('a_agency') $$,
  'P0001', null, 'the remaining admin cannot be disabled');
select throws_ok(
  $$ delete from public.agency_members where user_id = tests.id('a_staff') and agency_id = tests.id('a_agency') $$,
  'P0001', null, 'even server code cannot remove the last admin');

-- ===========================================================================
-- create_agency
-- ===========================================================================
select tests.authenticate_as(tests.id('c_outsider'));
select lives_ok($$ select public.create_agency('Atlas Cars', 'atlas-cars') $$, 'a logged-in user can create an agency');
reset role;
select is(
  (select a.subscription_status || '/' || p.code || '/' || (a.trial_ends_at::date - current_date)
     from public.agencies a join public.plans p on p.id = a.plan_id where a.slug = 'atlas-cars'),
  'trial/pro/14', 'the new agency starts a 14-day trial on Pro');
select is(
  (select m.role from public.agency_members m join public.agencies a on a.id = m.agency_id
    where a.slug = 'atlas-cars' and m.user_id = tests.id('c_outsider')),
  'admin', 'the creator is the first admin');
select tests.act_as_anon();
select throws_ok($$ select public.create_agency('Anon', 'anon-agency') $$, '42501', null,
  'an anonymous visitor cannot create an agency');

-- ===========================================================================
-- Plan limit on cars
-- ===========================================================================
reset role;
update public.agencies set plan_id = (select id from public.plans where code = 'essentiel')
 where id = tests.id('a_agency');
insert into public.vehicles (agency_id, plate, brand_model, category, fuel, gearbox, daily_rate)
select tests.id('a_agency'), 'LIM-' || g, 'Test', 'economy', 'diesel', 'manuelle', 100
from generate_series(1, 14) g;   -- 1 + 14 = 15 cars = Essentiel limit
select tests.authenticate_as(tests.id('a_staff'));  -- a_staff is now admin of A
select throws_ok(
  $$ insert into public.vehicles (agency_id, plate, brand_model, category, fuel, gearbox, daily_rate)
     values (tests.id('a_agency'), 'LIM-16', 'Test', 'economy', 'diesel', 'manuelle', 100) $$,
  'P0001', null, 'adding a 16th car on the Essentiel plan (15 cars) is refused');

-- ===========================================================================
-- Invitations
-- ===========================================================================
select tests.authenticate_as(tests.id('c_outsider'));
select is(public.accept_invitation('token-a'), tests.id('a_agency'), 'the invited user joins with the token');
select throws_ok($$ select public.accept_invitation('token-a') $$, 'P0001', null,
  'an invitation cannot be used twice');

select * from finish();
rollback;
