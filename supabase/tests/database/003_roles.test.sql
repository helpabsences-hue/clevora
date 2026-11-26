-- Roles inside one agency: staff does daily work, never sees money or the team;
-- admins do everything except billing fields (Parcolia only).
begin;
set local search_path = public, extensions, tests;
select plan(41);

select tests.create_fixture();

-- ===========================================================================
-- STAFF of agency A
-- ===========================================================================
select tests.authenticate_as(tests.id('a_staff'));

-- What staff can see
select cmp_ok(tests.count_rows(t, 'agency_id', tests.id('a_agency')), '>', 0,
              format('staff sees own agency %s', t))
from unnest(array['agency_members','vehicles','maintenance_periods','clients','reservations',
                  'reservation_payments','ai_documents','ai_chunks']) t;

-- What staff can NOT see
select is(tests.count_rows('charges', 'agency_id', tests.id('a_agency')), 0,
  'staff cannot read charges');
select is(tests.count_rows('activity_log', 'agency_id', tests.id('a_agency')), 0,
  'staff cannot read the activity log');
select is(tests.count_rows('invitations', 'agency_id', tests.id('a_agency')), 0,
  'staff cannot read invitations');

-- What staff can NOT do
select is(tests.try_insert('charges', tests.id('a_agency')), '42501', 'staff cannot add a charge');
select is(tests.update_rows('charges', 'agency_id', tests.id('a_agency')), 0, 'staff cannot change a charge');
select is(tests.try_insert('vehicles', tests.id('a_agency')), '42501', 'staff cannot add a car');
select is(tests.delete_rows('vehicles', 'agency_id', tests.id('a_agency')), 0, 'staff cannot delete a car');
select is(tests.delete_rows('reservations', 'agency_id', tests.id('a_agency')), 0, 'staff cannot delete a reservation');
select is(tests.delete_rows('clients', 'agency_id', tests.id('a_agency')), 0, 'staff cannot delete a client');
select throws_ok(
  $$ update public.vehicles set daily_rate = 1 where id = tests.id('a_vehicle') $$,
  '42501', null, 'staff cannot change the daily rate of a car');
select throws_ok(
  $$ update public.vehicles set plate = 'XX-1' where id = tests.id('a_vehicle') $$,
  '42501', null, 'staff cannot change the plate of a car');
select is(tests.update_rows('agencies', 'id', tests.id('a_agency')), 0, 'staff cannot change agency settings');
select is(tests.update_rows('agency_members', 'agency_id', tests.id('a_agency')), 0, 'staff cannot change team members');
select is(tests.try_insert('invitations', tests.id('a_agency')), '42501', 'staff cannot invite users');
select is(tests.update_rows('reservation_payments', 'agency_id', tests.id('a_agency')), 0, 'staff cannot edit a payment');
select is(tests.try_insert('ai_documents', tests.id('a_agency')), '42501', 'staff cannot upload AI documents');

-- What staff CAN do (daily work)
select lives_ok(
  $$ update public.vehicles
        set current_km = 51000, oil_last_km = 50900, oil_last_date = current_date, oil_next_km = 60900,
            insurance_expires_on = current_date + 365, technical_visit_expires_on = current_date + 365
      where id = tests.id('a_vehicle') $$,
  'staff can update km, vidange, assurance and visite of a car');
select is(tests.try_insert('clients', tests.id('a_agency')), 'ok', 'staff can add a client');
select is(tests.try_insert('reservations', tests.id('a_agency')), 'ok', 'staff can add a reservation');
select is(tests.try_insert('maintenance_periods', tests.id('a_agency')), 'ok', 'staff can put a car in maintenance');
select is(tests.try_insert('reservation_payments', tests.id('a_agency')), 'ok', 'staff can record a payment');
select is(tests.update_rows('reservations', 'agency_id', tests.id('a_agency')), 2, 'staff can edit reservations');
select is(tests.try_insert('activity_log', tests.id('a_agency')), 'ok', 'staff can write to the activity log as themselves');
select throws_ok(
  $$ insert into public.activity_log (agency_id, actor_id, action, entity)
     values (tests.id('a_agency'), tests.id('a_admin'), 'fake', 'fake') $$,
  '42501', null, 'staff cannot write to the activity log in someone else''s name');

-- ===========================================================================
-- ADMIN of agency A
-- ===========================================================================
select tests.authenticate_as(tests.id('a_admin'));

select cmp_ok(tests.count_rows('charges', 'agency_id', tests.id('a_agency')), '>', 0, 'admin reads charges');
select cmp_ok(tests.count_rows('activity_log', 'agency_id', tests.id('a_agency')), '>', 0, 'admin reads the activity log');
with u as (update public.agencies set name = 'Agence A modifiée'
            where id = tests.id('a_agency') returning 1)
select is((select count(*)::int from u), 1, 'admin can change agency settings');
select throws_ok(
  $$ update public.agencies set trial_ends_at = now() + interval '1 year' where id = tests.id('a_agency') $$,
  '42501', null, 'admin cannot extend their own trial');
select throws_ok(
  $$ update public.agencies set subscription_status = 'active' where id = tests.id('a_agency') $$,
  '42501', null, 'admin cannot activate their own subscription');
select throws_ok(
  $$ update public.agency_members set role = 'staff' where user_id = tests.id('a_admin') $$,
  '42501', null, 'nobody can change their own role');
select throws_ok(
  $$ update public.activity_log set action = 'x' where agency_id = tests.id('a_agency') $$,
  '42501', null, 'activity log cannot be edited, even by an admin');
select throws_ok(
  $$ delete from public.activity_log where agency_id = tests.id('a_agency') $$,
  '42501', null, 'activity log cannot be deleted, even by an admin');

-- ===========================================================================
-- PARCOLIA platform admin
-- ===========================================================================
select tests.authenticate_as(tests.id('e_platform'));
select lives_ok(
  $$ update public.agencies set subscription_status = 'active', current_period_end = now() + interval '1 month'
      where id = tests.id('a_agency') $$,
  'Parcolia platform admin can confirm a payment (billing fields)');

select * from finish();
rollback;
