-- Réservations: atomic save with client autofill/update, availability, search, infractions, return.
begin;
set local search_path = public, extensions, tests;
select plan(17);

select tests.create_fixture();
select tests.authenticate_as(tests.id('a_staff'));

-- New reservation for an existing CIN (written differently) + a new second driver
create temp table saved (id uuid);
grant all on saved to public;
insert into saved
select public.save_reservation(tests.id('a_agency'), null, jsonb_build_object(
  'vehicle_id', tests.id('a_vehicle'),
  'start_at', date_trunc('day', now()) + interval '60 days 10 hours',
  'end_at',   date_trunc('day', now()) + interval '63 days 10 hours',
  'daily_price', 300, 'delivery', true, 'delivery_place', 'Aéroport', 'delivery_fee', 150,
  'deposit_taken', true, 'deposit_amount', 3000, 'deposit_method', 'cheque',
  'km_out', 50000, 'fuel_out', 4, 'equipment', jsonb_build_array('Cric'), 'documents_given', jsonb_build_array('Carte grise'),
  'advance', jsonb_build_object('amount', 300, 'method', 'cash'),
  'driver1', jsonb_build_object('id_type', 'cin', 'id_number', 'tt-a 1001', 'full_name', 'Client a (nouveau nom)', 'phone', '+212611111111'),
  'driver2', jsonb_build_object('id_type', 'passport', 'id_number', 'XP998877', 'full_name', 'Second Driver')
));

select isnt((select id from saved), null, 'save_reservation returns the new id');
select is((select contract_number from public.reservations where id = (select id from saved)), 'C-2', 'empty contract number → next number');
select is((select count(*)::int from public.clients where agency_id = tests.id('a_agency') and id_number_norm = 'TTA1001'), 1,
  'an existing CIN is reused, not duplicated');
select is((select full_name from public.clients where id = tests.id('a_client')), 'Client a (nouveau nom)',
  'editing the autofilled fields updates the client');
select is((select count(*)::int from public.clients where agency_id = tests.id('a_agency') and id_number_norm = 'XP998877'), 1,
  'a new ID number creates a new client');
select is((select advance_paid from public.reservations where id = (select id from saved)), 300.00::numeric, 'advance recorded as a payment');
select is((select total::numeric from public.reservation_totals where id = (select id from saved)), 1050.00::numeric, 'total = 3 days × 300 + delivery 150');
select is((select balance::numeric from public.reservation_totals where id = (select id from saved)), 750.00::numeric, 'balance = total − advance');

-- Availability for the same dates: the car is booked
select is(
  (select reason from public.vehicle_availability(tests.id('a_agency'), date_trunc('day', now()) + interval '61 days', date_trunc('day', now()) + interval '62 days') where vehicle_id = tests.id('a_vehicle')),
  'booked', 'the car is not available on booked dates');
select is(
  (select reason from public.vehicle_availability(tests.id('a_agency'), date_trunc('day', now()) + interval '61 days', date_trunc('day', now()) + interval '62 days', (select id from saved)) where vehicle_id = tests.id('a_vehicle')),
  null, 'excluding the reservation itself (extension) the car is free');

-- Search by phone digits, CIN and plate
select ok((select id from saved) in (select public.search_reservation_ids(tests.id('a_agency'), '0611 111 111')), 'search by phone (any format)');
select ok((select id from saved) in (select public.search_reservation_ids(tests.id('a_agency'), 'XP99')), 'search by the second driver passport');
select ok((select id from saved) in (select public.search_reservation_ids(tests.id('a_agency'), '1000a a')), 'search by plate');

select tests.authenticate_as(tests.id('a_staff'));
select is((select count(*)::int from public.reservation_totals where agency_id = tests.id('b_agency')), 0,
  'agency A cannot read the totals of agency B');

-- A rental cannot start before the contract is signed
select throws_ok(
  format($$ update public.reservations set status = 'on_rental' where id = %L $$, (select id from saved)),
  '23514', null, 'start rental refused while the contract is not signed');

-- Start, then return: car km updated, payments recorded
update public.reservations set status = 'on_rental', signed_at = now(), signed_by = tests.id('a_staff') where id = (select id from saved);
select public.return_reservation(tests.id('a_agency'), (select id from saved), jsonb_build_object(
  'actual_return_at', date_trunc('day', now()) + interval '63 days 9 hours',
  'km_in', 50900, 'fuel_in', 3,
  'balance', jsonb_build_object('amount', 750, 'method', 'card'),
  'deposit_refund', jsonb_build_object('amount', 3000, 'method', 'cheque')
));
reset role;
select is((select current_km from public.vehicles where id = tests.id('a_vehicle')), 50900, 'return updates the car km');

-- Infraction finder: who had the car during the rental?
select tests.authenticate_as(tests.id('a_staff'));
select ok(
  (select id from saved) in (select public.who_had_car(tests.id('a_agency'), '1000A-A-6',
     date_trunc('day', now()) + interval '62 days 14 hours', date_trunc('day', now()) + interval '62 days 14 hours')),
  'who_had_car finds the rental at that moment');

select * from finish();
rollback;
