-- Storage: every path starts with the agency id; receipts (charges/) are admin-only.
begin;
set local search_path = public, extensions, tests;
select plan(15);

select tests.create_fixture();

-- Real Supabase only allows deletes coming from the Storage API, which sets this
-- flag and then relies on the RLS policies below. Set it so we test those policies.
set local storage.allow_delete_query = 'true';

create temp table ids as select tests.id('a_agency')::text as a, tests.id('b_agency')::text as b;
grant select on ids to public;

-- ---------------------------------------------------------------------------
-- Admin of A
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('a_admin'));

select is(
  (select count(*)::int from storage.objects where name like (select b from ids) || '/%'), 0,
  'A admin cannot list or read any file of agency B');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-docs', '%s/contrats/pirate.pdf') $$,
         (select b from ids)),
  '42501', null, 'A admin cannot upload into agency B documents');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-logos', '%s/logo-pirate.png') $$,
         (select b from ids)),
  '42501', null, 'A admin cannot replace the logo of agency B');
with u as (update storage.objects set metadata = '{"x":1}'
            where name like (select b from ids) || '/%' returning 1)
select is((select count(*)::int from u), 0, 'A admin cannot modify files of agency B');
with d as (delete from storage.objects where name like (select b from ids) || '/%' returning 1)
select is((select count(*)::int from d), 0, 'A admin cannot delete files of agency B');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-docs', '%s/charges/recu-2.jpg') $$,
         (select a from ids)),
  'A admin can upload a receipt in their own agency');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-logos', '%s/logo-v2.png') $$,
         (select a from ids)),
  'A admin can upload their own logo');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('agency-docs', 'sans-agence.pdf') $$,
  '42501', null, 'a file outside an agency folder is refused');

-- ---------------------------------------------------------------------------
-- Staff of A
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('a_staff'));

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'agency-docs' and name like (select a from ids) || '/contrats/%'), 1,
  'staff can read their agency contracts/documents');
select is(
  (select count(*)::int from storage.objects
    where name like (select a from ids) || '/charges/%'), 0,
  'staff cannot read receipts (charges)');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-docs', '%s/contrats/signature.png') $$,
         (select a from ids)),
  'staff can upload a document (e.g. a signature)');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-docs', '%s/charges/recu-3.jpg') $$,
         (select a from ids)),
  '42501', null, 'staff cannot upload receipts');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('agency-logos', '%s/logo-staff.png') $$,
         (select a from ids)),
  '42501', null, 'staff cannot change the agency logo');
with d as (delete from storage.objects where name like (select a from ids) || '/%' returning 1)
select is((select count(*)::int from d), 0, 'staff cannot delete files');

-- ---------------------------------------------------------------------------
-- User without agency
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('c_outsider'));
select is((select count(*)::int from storage.objects), 0, 'a user without agency sees no file at all');

select * from finish();
rollback;
