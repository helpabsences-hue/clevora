-- Owner console: Parcolia admins only; at least one Parcolia admin always stays.
begin;
set local search_path = public, extensions, tests;
select plan(9);

select tests.create_fixture();

select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$ select public.platform_stats() $$, '42501', null, 'an agency admin cannot see platform numbers');
select throws_ok($$ select * from public.platform_users() $$, '42501', null, 'nor the list of accounts');
select throws_ok($$ select public.platform_agency_activity(tests.id('b_agency')) $$, '42501', null, 'nor another agency''s activity');
select throws_ok($$ select public.platform_set_admin('admin.a@test.ma', true) $$, '42501', null, 'nor make itself Parcolia admin');

select tests.authenticate_as(tests.id('e_platform'));
select ok((public.platform_stats() ->> 'agencies')::int >= 2, 'Parcolia sees the platform numbers');
select ok((select count(*) from public.platform_users()) >= 5, 'and every account');
select ok((public.platform_agency_activity(tests.id('a_agency')) ->> 'clients')::int >= 1, 'and an agency''s activity (counts)');
select throws_ok($$ select public.platform_set_admin('platform@parcolia.ma', false) $$, 'P0001', null, 'nobody removes their own access');
select throws_ok($$ select public.platform_set_admin('nobody@nowhere.ma', true) $$, 'P0002', null, 'unknown e-mail is refused');

select * from finish();
rollback;
