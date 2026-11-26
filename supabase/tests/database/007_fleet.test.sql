-- Parc auto: maintenance blocks booking only during its dates.
begin;
set local search_path = public, extensions, tests;
select plan(8);

select tests.create_fixture();

-- Car a_vehicle: maintenance from day+40 to day+44 (expected), still open
insert into public.maintenance_periods (agency_id, vehicle_id, reason, starts_on, expected_end_on)
values (tests.id('a_agency'), tests.id('a_vehicle'), 'panne', current_date + 40, current_date + 44);

select tests.authenticate_as(tests.id('a_staff'));

select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 42) + time '10:00', (current_date + 43) + time '10:00', 250) $$,
  'P0001', null, 'booking inside the maintenance dates is refused');

select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 38) + time '10:00', (current_date + 40) + time '09:00', 250) $$,
  'P0001', null, 'a booking that ends on the first maintenance day is refused');

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 35) + time '10:00', (current_date + 39) + time '10:00', 250) $$,
  'booking before the maintenance is accepted');

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 45) + time '10:00', (current_date + 47) + time '10:00', 250) $$,
  'booking after the expected end is accepted');

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price, status, contract_number)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 41) + time '10:00', (current_date + 42) + time '10:00', 250, 'cancelled', 'X-CANCEL') $$,
  'a cancelled reservation inside the dates is not blocked');

-- Back in service early (day+42): days from +42 are free again
reset role;
update public.maintenance_periods set ended_on = current_date + 42
 where vehicle_id = tests.id('a_vehicle') and reason = 'panne';
select tests.authenticate_as(tests.id('a_staff'));

select lives_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
             (current_date + 42) + time '14:00', (current_date + 44) + time '10:00', 250) $$,
  'after "Remettre en service" the car can be booked again from that day');

select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client2'),
             (current_date + 40) + time '10:00', (current_date + 41) + time '10:00', 250) $$,
  'P0001', null, 'the days it was really in the garage stay blocked');

select is(
  public.maintenance_blocked_days(current_date, null, null) @> (current_date + 1000),
  true, 'an open maintenance without expected date blocks until it ends');

select * from finish();
rollback;
