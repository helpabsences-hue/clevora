-- Statistiques and recurring charges.
begin;
set local search_path = public, extensions, tests;
select plan(9);

select tests.create_fixture();

-- A rental across two months: 30/10 10:00 → 03/11 10:00 = 4 days × 300, delivery 100
insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, actual_return_at, daily_price, delivery, delivery_place, delivery_fee, status, signed_at, contract_number)
values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'),
        '2025-10-30 10:00 Africa/Casablanca', '2025-11-03 10:00 Africa/Casablanca', '2025-11-03 09:00 Africa/Casablanca',
        300, true, 'Gare', 100, 'returned', now(), 'STAT-1');
insert into public.charges (agency_id, date, category, vehicle_id, amount) values
  (tests.id('a_agency'), '2025-11-02', 'lavage', tests.id('a_vehicle'), 50),
  (tests.id('a_agency'), '2025-11-05', 'loyer', null, 4000);

select tests.authenticate_as(tests.id('a_admin'));
select is((select sum(revenue)::numeric from public.stats_daily(tests.id('a_agency'), '2025-10-01', '2025-10-31')), 700.00::numeric,
  'October gets 2 days (300 × 2) + the delivery fee');
select is((select sum(revenue)::numeric from public.stats_daily(tests.id('a_agency'), '2025-11-01', '2025-11-30')), 600.00::numeric,
  'November gets the other 2 days');
select is((select sum(rented_days)::int from public.stats_daily(tests.id('a_agency'), '2025-10-01', '2025-11-30')), 4, '4 rented days in total');
select is((select sum(charges)::numeric from public.stats_daily(tests.id('a_agency'), '2025-11-01', '2025-11-30')), 4050.00::numeric, 'charges of the month');
select is(
  (select revenue - charges from public.stats_by_vehicle(tests.id('a_agency'), '2025-11-01', '2025-11-30') where vehicle_id = tests.id('a_vehicle')),
  550.00::numeric, 'net per car = its revenue − its own charges (agency rent is not split)');
select is((select count(*)::int from public.stats_daily(tests.id('a_agency'), '2025-11-01', '2025-11-30')), 30, 'one row per day');

select tests.authenticate_as(tests.id('a_staff'));
select throws_ok($$ select * from public.stats_daily(tests.id('a_agency'), '2025-11-01', '2025-11-30') $$, '42501', null,
  'staff cannot get statistics');
select tests.authenticate_as(tests.id('b_admin'));
select throws_ok($$ select * from public.stats_by_vehicle(tests.id('a_agency'), '2025-11-01', '2025-11-30') $$, '42501', null,
  'another agency cannot get them either');

-- Recurring charges: copied once per month
select tests.authenticate_as(tests.id('a_admin'));
update public.charges set is_recurring = true where category = 'loyer' and agency_id = tests.id('a_agency');
select public.generate_recurring_charges(tests.id('a_agency'), '2025-12-15');
select public.generate_recurring_charges(tests.id('a_agency'), '2025-12-20');
select is((select count(*)::int from public.charges where agency_id = tests.id('a_agency') and category = 'loyer' and date = '2025-12-05'), 1,
  'the monthly rent is created once for December, on the same day of the month');

select * from finish();
rollback;
