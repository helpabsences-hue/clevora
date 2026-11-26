-- Rate limits: counted per key, reset after the window, invisible to users.
begin;
set local search_path = public, extensions, tests;
select plan(6);

select is(public.rate_limit_hit('t:a', 2, 60), true, '1st attempt allowed');
select is(public.rate_limit_hit('t:a', 2, 60), true, '2nd attempt allowed');
select is(public.rate_limit_hit('t:a', 2, 60), false, '3rd attempt blocked');
select is(public.rate_limit_hit('t:b', 2, 60), true, 'other keys are independent');
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 't:a';
select is(public.rate_limit_hit('t:a', 2, 60), true, 'allowed again after the window');

select tests.create_fixture();
select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$ select public.rate_limit_hit('x', 1, 60) $$, '42501', null, 'users cannot call the limiter (server only)');

select * from finish();
rollback;
