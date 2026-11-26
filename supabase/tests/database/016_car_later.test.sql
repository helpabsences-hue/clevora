-- Reservations without a car: allowed while booked, car chosen before signing.
begin;
set local search_path = public, extensions, tests;
select plan(8);

select tests.create_fixture();
select tests.authenticate_as(tests.id('a_staff'));

select lives_ok($$
  insert into public.reservations (id, agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
  values ('aaaaaaaa-0000-4000-8000-0000000009a1', tests.id('a_agency'), null, tests.id('a_client'), now() + interval '50 days', now() + interval '53 days', 300, 'LATER-1')
$$, 'a reservation can be saved without a car');

select throws_ok($$ update public.reservations set signed_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000009a1' $$,
  '23514', null, 'a contract cannot be signed without a car');

select tests.authenticate_as(tests.id('b_staff'));
select throws_ok($$ select public.assign_vehicle(tests.id('a_agency'), 'aaaaaaaa-0000-4000-8000-0000000009a1', tests.id('a_vehicle')) $$,
  '42501', null, 'another agency cannot assign a car');

select tests.authenticate_as(tests.id('a_staff'));
select lives_ok($$ select public.assign_vehicle(tests.id('a_agency'), 'aaaaaaaa-0000-4000-8000-0000000009a1', tests.id('a_vehicle'), 350) $$,
  'the car is chosen later, with a new price');
select is((select daily_price from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000009a1'), 350.00::numeric, 'price updated');
select lives_ok($$ update public.reservations set signed_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000009a1' $$, 'then it can be signed');

-- Double booking still blocked when assigning
select lives_ok($$
  insert into public.reservations (id, agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
  values ('aaaaaaaa-0000-4000-8000-0000000009a2', tests.id('a_agency'), null, tests.id('a_client2'), now() + interval '51 days', now() + interval '52 days', 300, 'LATER-2')
$$, 'second car-less reservation on the same dates');

select throws_ok($$ select public.assign_vehicle(tests.id('a_agency'), 'aaaaaaaa-0000-4000-8000-0000000009a2', tests.id('a_vehicle')) $$,
  '23P01', null, 'but giving it a car already booked on those dates is refused');

select * from finish();
rollback;
