-- Vidange history: staff record it, only admins correct or delete it.
begin;
set local search_path = public, extensions, tests;
select plan(6);

select tests.create_fixture();
select tests.authenticate_as(tests.id('a_staff'));

select lives_ok($$
  insert into public.oil_changes (agency_id, vehicle_id, km, next_km, items)
  values (tests.id('a_agency'), tests.id('a_vehicle'), 50000, 60000, array['huile','filtre_air','courroie'])
$$, 'staff record a vidange with several items');
select throws_ok($$
  insert into public.oil_changes (agency_id, vehicle_id, km, items)
  values (tests.id('a_agency'), tests.id('a_vehicle'), 50000, array['moteur'])
$$, '23514', null, 'unknown items are refused');
select throws_ok($$
  insert into public.oil_changes (agency_id, vehicle_id, km, next_km)
  values (tests.id('a_agency'), tests.id('a_vehicle'), 50000, 40000)
$$, '23514', null, 'next vidange must be after this one');
select is(tests.update_rows('oil_changes', 'agency_id', tests.id('a_agency')), 0,
  'staff cannot change the history');

select tests.authenticate_as(tests.id('a_admin'));
select is(tests.update_rows('oil_changes', 'agency_id', tests.id('a_agency')), 2,
  'admins can correct it');
select is(tests.delete_rows('oil_changes', 'agency_id', tests.id('a_agency')), 2,
  'admins can delete it');

select * from finish();
rollback;
