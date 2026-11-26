-- Achat et crédit: admins only; profitability numbers.
begin;
set local search_path = public, extensions, tests;
select plan(11);

select tests.create_fixture();

select tests.authenticate_as(tests.id('a_staff'));
select is((select count(*)::int from public.vehicle_finance), 0, 'staff cannot see the purchase and credit of cars');
select throws_ok($$ select * from public.vehicle_profitability(tests.id('a_agency')) $$, '42501', null, 'staff cannot see profitability');
select is(tests.try_insert('vehicle_finance', tests.id('a_agency')), '42501', 'staff cannot record a purchase');

select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$
  insert into public.vehicle_finance (agency_id, vehicle_id, purchase_date, purchase_price, mode)
  values (tests.id('a_agency'), tests.id('a_vehicle'), current_date, 1000, 'credit')
$$, '23514', null, 'a credit needs the monthly payment, months and first payment date');

create temp table p as select * from public.vehicle_profitability(tests.id('a_agency'));
grant select on p to public;
-- Fixture: 30 000 apport + 3 000 × 48, first payment 370 days ago => 13 payments made
select is((select months_paid from p), 13, 'months paid so far');
select is((select paid_so_far from p), 69000.00::numeric, 'paid so far = apport + 13 × 3 000');
select is((select credit_left from p), 105000.00::numeric, 'credit left = 35 × 3 000');
select is((select total_cost from p), 174000.00::numeric, 'total cost of the credit');
select is((select credit_month from p), 3000.00::numeric, 'this month''s credit payment');
select ok((select revenue_month >= 0 and charges_month >= 0 from p), 'this month''s rent and charges are computed');
select tests.authenticate_as(tests.id('b_admin'));
select is((select count(*)::int from public.vehicle_profitability(tests.id('b_agency')) where vehicle_id = tests.id('a_vehicle')), 0, 'never another agency''s cars');

select * from finish();
rollback;
