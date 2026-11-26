-- Supabase usage numbers: Parcolia staff only.
begin;
set local search_path = public, extensions, tests;
select plan(4);

select tests.create_fixture();

select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$ select * from public.platform_usage() $$, '42501', null, 'an agency admin cannot see platform usage');
select is((select count(*)::int from public.usage_alerts_sent), 0, 'nobody but the service role reads usage alerts');

select tests.authenticate_as(tests.id('e_platform'));
select lives_ok($$ select * from public.platform_usage() $$, 'a platform admin can');
select cmp_ok((select database_bytes from public.platform_usage()), '>', 0::bigint, 'database size is measured');

select * from finish();
rollback;
