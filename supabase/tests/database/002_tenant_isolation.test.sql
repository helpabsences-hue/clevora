-- A user of agency A can NOT read or write any row of agency B — on every table.
begin;
set local search_path = public, extensions, tests;
select plan(199);

select tests.create_fixture();

-- Fingerprint of everything agency B owns, taken before the attacks
create temp table b_before as select tests.agency_fingerprint(tests.id('b_agency')) as fp;
grant select on b_before to public;

-- ---------------------------------------------------------------------------
-- Sanity: the A admin really sees A's own rows (so the zeros below mean something)
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('a_admin'));

select cmp_ok(tests.count_rows(t.name, t.col, tests.id('a_agency')), '>', 0,
              format('A admin sees own %s', t.name))
from tests.tenant_tables() t;

-- ---------------------------------------------------------------------------
-- A admin vs agency B: read, update, delete, insert
-- ---------------------------------------------------------------------------
select is(tests.count_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A admin cannot READ B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.update_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A admin cannot UPDATE B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.delete_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A admin cannot DELETE B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.try_insert(t.name, tests.id('b_agency')), '42501',
          format('A admin cannot INSERT into %s for agency B', t.name))
from tests.tenant_tables() t;

-- Cross-agency references and functions
select is(
  (select count(*)::int from public.profiles where id in (tests.id('b_admin'), tests.id('b_staff'))), 0,
  'A admin cannot read profiles of B users'
);
select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('b_vehicle'), tests.id('a_client'),
             now() + interval '300 days', now() + interval '301 days', 100) $$,
  '23503', null,
  'A reservation of agency A cannot use a car of agency B'
);
select throws_ok(
  $$ insert into public.reservations (agency_id, vehicle_id, client_id, start_at, end_at, daily_price)
     values (tests.id('a_agency'), tests.id('a_vehicle'), tests.id('b_client'),
             now() + interval '300 days', now() + interval '301 days', 100) $$,
  '23503', null,
  'A reservation of agency A cannot use a client of agency B'
);
select throws_ok(
  $$ update public.vehicles set agency_id = tests.id('b_agency') where id = tests.id('a_vehicle') $$,
  '42501', null,
  'A row cannot be moved to another agency'
);
select throws_ok($$ select public.next_contract_number(tests.id('b_agency')) $$, '42501', null,
  'A admin cannot take a contract number of agency B');
select throws_ok($$ select public.preview_contract_number(tests.id('b_agency')) $$, '42501', null,
  'A admin cannot preview a contract number of agency B');
select throws_ok(
  $$ select * from public.match_chunks(tests.id('b_agency'), array_fill(-0.01::real, array[1536])::extensions.vector, 5) $$,
  '42501', null,
  'A admin cannot search the AI documents of agency B'
);
select throws_ok($$ select public.accept_invitation('token-b') $$, '42501', null,
  'A admin cannot accept an invitation sent to someone else');

-- ---------------------------------------------------------------------------
-- A staff vs agency B
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('a_staff'));

select is(tests.count_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A staff cannot READ B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.update_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A staff cannot UPDATE B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.delete_rows(t.name, t.col, tests.id('b_agency')), 0,
          format('A staff cannot DELETE B rows in %s', t.name))
from tests.tenant_tables() t;

select is(tests.try_insert(t.name, tests.id('b_agency')), '42501',
          format('A staff cannot INSERT into %s for agency B', t.name))
from tests.tenant_tables() t;

-- ---------------------------------------------------------------------------
-- A logged-in user with no agency sees nothing at all
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('c_outsider'));

select is(
  tests.count_rows(t.name, t.col, tests.id('a_agency')) + tests.count_rows(t.name, t.col, tests.id('b_agency')),
  0, format('user without agency cannot read %s', t.name))
from tests.tenant_tables() t;

-- ---------------------------------------------------------------------------
-- Agency B is exactly as before
-- ---------------------------------------------------------------------------
reset role;
select is(tests.agency_fingerprint(tests.id('b_agency')), (select fp from b_before),
          'agency B data is byte-for-byte unchanged after all attempts');

select * from finish();
rollback;
