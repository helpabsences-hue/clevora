-- Every table is protected, and every agency table is covered by the isolation tests.
begin;
set local search_path = public, extensions, tests;
select plan(10);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every table in public'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'every table in public has at least one policy'
);

select is_empty(
  $$ select c.table_name::text from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'agency_id' and t.table_type = 'BASE TABLE'
     except select name from tests.tenant_tables() $$,
  'every table with agency_id is covered by the tenant isolation tests'
);

select is_empty(
  $$ select c.table_name::text from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'agency_id' and c.is_nullable = 'YES' and t.table_type = 'BASE TABLE' $$,
  'agency_id is NOT NULL everywhere'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'every SECURITY DEFINER function has a fixed search_path'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS is enabled on storage.objects'
);

select tests.create_fixture();

select tests.act_as_anon();
select is(
  (select count(*)::int from public.plans), 3,
  'anonymous visitors can read the active plans (pricing page)'
);
select is(
  (select sum(tests.count_rows(t.name, t.col, a))::int
   from tests.tenant_tables() t, unnest(array[tests.id('a_agency'), tests.id('b_agency')]) a),
  0,
  'anonymous visitors cannot read any agency data'
);
select is(
  tests.try_insert('vehicles', tests.id('a_agency')), '42501',
  'anonymous visitors cannot write agency data'
);

reset role;
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and not coalesce(array_to_string(c.reloptions, ',') like '%security_invoker=true%', false) $$,
  'every view runs with the caller''s rights (security_invoker), so RLS applies'
);

select * from finish();
rollback;
