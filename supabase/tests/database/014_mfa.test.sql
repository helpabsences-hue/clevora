-- Two-step login: with a verified factor, the agency stays closed until the session is AAL2.
begin;
set local search_path = public, extensions, tests;
select plan(5);

select tests.create_fixture();

select tests.authenticate_as(tests.id('a_admin'));
select is((select count(*)::int from public.vehicles where agency_id = tests.id('a_agency')), 1, 'no factor: normal access');

reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), tests.id('a_admin'), 'Téléphone', 'totp', 'verified', now(), now(), 'SECRET');

-- Password only (aal1)
select set_config('request.jwt.claims', json_build_object('sub', tests.id('a_admin'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
set local role authenticated;
select is((select count(*)::int from public.vehicles where agency_id = tests.id('a_agency')), 0, 'factor + password only: no data');
select is(tests.try_insert('charges', tests.id('a_agency')), '42501', 'factor + password only: no writes');

-- Code entered (aal2)
select set_config('request.jwt.claims', json_build_object('sub', tests.id('a_admin'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
select is((select count(*)::int from public.vehicles where agency_id = tests.id('a_agency')), 1, 'factor + code: access again');

-- Other users are not affected
select tests.authenticate_as(tests.id('a_staff'));
select is((select count(*)::int from public.vehicles where agency_id = tests.id('a_agency')), 1, 'staff without a factor: normal access');

select * from finish();
rollback;
