-- SaaS: subscription requests/confirmation, invoices, public booking page and requests.
begin;
set local search_path = public, extensions, tests;
select plan(19);

select tests.create_fixture();

-- Subscription request ---------------------------------------------------------
select tests.authenticate_as(tests.id('a_staff'));
select throws_ok($$ select * from public.request_subscription(tests.id('a_agency'), 'pro', 'month', 'virement') $$, '42501', null,
  'staff cannot ask for a plan');
select tests.authenticate_as(tests.id('b_admin'));
select throws_ok($$ select * from public.request_subscription(tests.id('a_agency'), 'pro', 'month', 'virement') $$, '42501', null,
  'another agency cannot ask for A''s plan');

select tests.authenticate_as(tests.id('a_admin'));
create temp table req as select * from public.request_subscription(tests.id('a_agency'), 'illimite', 'year', 'virement');
grant select on req to authenticated;
select is((select amount from req), 9990.00::numeric, 'yearly price of Illimité');
select matches((select reference from req), '^PAR-[0-9A-F]{8}$', 'a reference to write on the transfer');
select is((select count(*)::int from public.subscription_payments where agency_id = tests.id('a_agency') and status = 'pending'), 1,
  'the admin sees the pending payment');
select throws_ok($$ select public.confirm_subscription_payment((select id from req)) $$, '42501', null,
  'an agency admin cannot confirm their own payment');
update public.subscription_payments set status = 'paid', invoice_number = 'F-FAKE', paid_at = now() where id = (select id from req);
reset role;
select is((select status from public.subscription_payments where id = (select id from req)), 'pending', 'nor mark it paid directly');

select tests.authenticate_as(tests.id('b_admin'));
select is((select count(*)::int from public.subscription_payments where agency_id = tests.id('a_agency')), 0, 'B never sees A''s payments');

-- Parcolia confirms --------------------------------------------------------------
select tests.authenticate_as(tests.id('e_platform'));
select matches(public.confirm_subscription_payment((select id from req)), '^F-\d{4}-\d{5}$', 'invoice number on confirmation');
reset role;
select is((select subscription_status from public.agencies where id = tests.id('a_agency')), 'active', 'agency is active');
select is((select p.code from public.agencies a join public.plans p on p.id = a.plan_id where a.id = tests.id('a_agency')), 'illimite', 'plan switched');
select ok((select current_period_end > now() + interval '360 days' from public.agencies where id = tests.id('a_agency')), 'one year paid');
select tests.authenticate_as(tests.id('e_platform'));
select throws_ok($$ select public.confirm_subscription_payment((select id from req)) $$, '22023', null, 'cannot confirm twice');

-- Public booking page --------------------------------------------------------------
reset role;
select is(public.public_agency('agence-test-a'), null, 'no public page until the agency turns it on');
update public.agencies set public_booking_enabled = true where id = tests.id('a_agency');
select tests.act_as_anon();
select ok(public.public_agency('agence-test-a') -> 'cars' -> 0 ? 'daily_rate' and not (public.public_agency('agence-test-a') -> 'cars' -> 0 ? 'plate'),
  'anyone sees the cars and prices, never the plates');
select throws_ok(
  $$ insert into public.booking_requests (agency_id, full_name, phone, start_date, end_date) values (tests.id('a_agency'), 'Robot', '0600000000', current_date + 1, current_date + 3) $$,
  '42501', null, 'anonymous visitors cannot write requests directly (server only, after the anti-robot check)');

reset role;
insert into public.booking_requests (agency_id, full_name, phone, start_date, end_date)
values (tests.id('a_agency'), 'Client Web', '+212600000009', current_date + 1, current_date + 3);
select tests.authenticate_as(tests.id('b_staff'));
select is((select count(*)::int from public.booking_requests where agency_id = tests.id('a_agency')), 0, 'other agencies never see the requests');

-- Platform overview ------------------------------------------------------------------
select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$ select * from public.platform_overview() $$, '42501', null, 'agency admins cannot list all agencies');
select tests.authenticate_as(tests.id('e_platform'));
select ok((select count(*) >= 2 from public.platform_overview()), 'Parcolia sees every agency');

select * from finish();
rollback;
