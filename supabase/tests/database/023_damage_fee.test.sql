-- Damages at return: kept from the caution, never more than the franchise.
begin;
set local search_path = public, extensions, tests;
select plan(11);

select tests.create_fixture();
-- 250 / day, advance 200; caution 2 000, franchise 5 000; the car is out
-- (returned now: 1 day = 250)
update public.reservations
   set status = 'on_rental', signed_at = now(), franchise = 5000, deposit_taken = true, deposit_amount = 2000
 where id = tests.id('a_reservation');
select tests.authenticate_as(tests.id('a_staff'));

select throws_ok($$
  select public.return_reservation(tests.id('a_agency'), tests.id('a_reservation'), '{"km_in": 100, "fuel_in": 4, "damage": {"amount": 6000}}'::jsonb)
$$, 'P0001', null, 'a damage fee above the franchise is refused');
select throws_ok($$
  select public.return_reservation(tests.id('a_agency'), tests.id('a_reservation'), '{"km_in": 100, "fuel_in": 4, "damage": {"amount": 1500}, "deposit_refund": {"amount": 1000, "method": "cash"}}'::jsonb)
$$, 'P0001', null, 'the caution given back cannot include what is kept for the damages');

select lives_ok($$
  select public.return_reservation(tests.id('a_agency'), tests.id('a_reservation'), '{"km_in": 100, "fuel_in": 4, "damage": {"amount": 3500, "note": "Bosse portière"}}'::jsonb)
$$, 'return with a 3 500 damage fee');
select is((select damage_fee from public.reservations where id = tests.id('a_reservation')), 3500.00, 'the fee is saved');
select is((select damage_note from public.reservations where id = tests.id('a_reservation')), 'Bosse portière', 'with what was damaged');
select is((select amount from public.reservation_payments where reservation_id = tests.id('a_reservation') and kind = 'extra'), 2000.00, 'the whole caution (2 000) is kept for the damages');
select is((select total from public.reservation_totals where id = tests.id('a_reservation')), 3750.00, 'total = 250 rental + 3 500 damages');
select is((select balance from public.reservation_totals where id = tests.id('a_reservation')), 1550.00, 'still owed: 50 rental + 1 500 damages the caution did not cover');

-- Statistiques: the fee is income on the day the car came back (admins only)
select throws_ok($$
  select * from public.stats_daily(tests.id('a_agency'), current_date - 1, current_date + 1)
$$, '42501', null, 'staff cannot read the statistics');
select tests.authenticate_as(tests.id('a_admin'));
select is((select sum(damages) from public.stats_daily(tests.id('a_agency'), current_date - 1, current_date + 1)), 3500.00, 'stats_daily: 3 500 of damage fees');
select is((select damages from public.stats_by_vehicle(tests.id('a_agency'), current_date - 1, current_date + 1) where vehicle_id = tests.id('a_vehicle')), 3500.00, 'stats_by_vehicle: on the car');

select * from finish();
rollback;
