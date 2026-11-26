-- Auth & onboarding: profile emails, agency creation, invitation preview, read-only mode.
begin;
set local search_path = public, extensions, tests;
select plan(22);

select tests.create_fixture();

-- ---------------------------------------------------------------------------
-- profiles.email
-- ---------------------------------------------------------------------------
select is((select email from public.profiles where id = tests.id('a_admin')), 'a.admin@test.ma',
  'the profile gets the login email');
update auth.users set email = 'NEW.ADMIN@test.ma' where id = tests.id('a_admin');
select is((select email from public.profiles where id = tests.id('a_admin')), 'new.admin@test.ma',
  'changing the login email updates the profile');

select tests.authenticate_as(tests.id('a_admin'));
select throws_ok(
  $$ update public.profiles set email = 'pirate@test.ma' where id = tests.id('a_admin') $$,
  '42501', null, 'a user cannot change their email through the profile');
select lives_ok(
  $$ update public.profiles set full_name = 'Admin A bis', preferred_theme = 'dark' where id = tests.id('a_admin') $$,
  'a user can change their name and theme');

-- ---------------------------------------------------------------------------
-- create_agency
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('c_outsider'));
select lives_ok(
  $$ select public.create_agency('Atlas Cars', 'atlas-cars', 'Marrakech', '+212524000000', '#C2410C') $$,
  'create_agency accepts city, phone and brand colour');
reset role;
select is(
  (select city || '|' || phone || '|' || brand_color from public.agencies where slug = 'atlas-cars'),
  'Marrakech|+212524000000|#C2410C', 'city, phone and colour are saved');
select tests.authenticate_as(tests.id('c_outsider'));
select throws_ok(
  $$ select public.create_agency_for_user(tests.id('c_outsider'), 'Pirate', 'pirate-agency') $$,
  '42501', null, 'create_agency_for_user is for the server (service role) only');

-- ---------------------------------------------------------------------------
-- invitation_preview (works before login)
-- ---------------------------------------------------------------------------
select tests.act_as_anon();
select is(
  (select agency_name || '|' || role || '|' || email || '|' || state from public.invitation_preview('token-a')),
  'Agence A|staff|outsider@test.ma|valid', 'a visitor with the link sees the agency, role and email');
select is((select state from public.invitation_preview('wrong-token')), 'invalid', 'an unknown token is invalid');
reset role;
update public.invitations set expires_at = now() - interval '1 day' where id = tests.id('b_invitation');
select tests.act_as_anon();
select is((select state from public.invitation_preview('token-b')), 'expired', 'an old invitation is expired');
select tests.authenticate_as(tests.id('c_outsider'));
select public.accept_invitation('token-a');
select tests.act_as_anon();
select is((select state from public.invitation_preview('token-a')), 'used', 'an accepted invitation is used');

-- ---------------------------------------------------------------------------
-- Read-only mode (trial over)
-- ---------------------------------------------------------------------------
reset role;
update public.agencies set trial_ends_at = now() - interval '1 hour' where id = tests.id('a_agency');

select tests.authenticate_as(tests.id('a_admin'));
select cmp_ok(tests.count_rows('reservations', 'agency_id', tests.id('a_agency')), '>', 0,
  'read-only: data is still visible');
select is(tests.try_insert('vehicles', tests.id('a_agency')), '42501', 'read-only: admin cannot add a car');
select is(tests.update_rows('agencies', 'id', tests.id('a_agency')), 0, 'read-only: admin cannot change settings');
select is(tests.try_insert('charges', tests.id('a_agency')), '42501', 'read-only: admin cannot add a charge');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-logos', '%s/logo-2.png') $$,
         tests.id('a_agency')),
  '42501', null, 'read-only: admin cannot upload a logo');

select tests.authenticate_as(tests.id('a_staff'));
select is(tests.try_insert('reservations', tests.id('a_agency')), '42501', 'read-only: staff cannot add a reservation');
select is(tests.try_insert('clients', tests.id('a_agency')), '42501', 'read-only: staff cannot add a client');

select tests.authenticate_as(tests.id('b_staff'));
select is(tests.try_insert('clients', tests.id('b_agency')), 'ok', 'another agency in trial is not affected');

-- Paid again => writable
reset role;
update public.agencies set subscription_status = 'active', current_period_end = now() + interval '1 month'
 where id = tests.id('a_agency');
select tests.authenticate_as(tests.id('a_staff'));
select is(tests.try_insert('clients', tests.id('a_agency')), 'ok', 'after payment the agency is writable again');

reset role;
update public.agencies set subscription_status = 'past_due' where id = tests.id('a_agency');
select tests.authenticate_as(tests.id('a_staff'));
select is(tests.try_insert('clients', tests.id('a_agency')), 'ok', 'past_due keeps working (grace period)');

reset role;
update public.agencies set subscription_status = 'suspended' where id = tests.id('a_agency');
select tests.authenticate_as(tests.id('a_staff'));
select is(tests.try_insert('clients', tests.id('a_agency')), '42501', 'a suspended agency is read-only');

select * from finish();
rollback;
