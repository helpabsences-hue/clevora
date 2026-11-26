-- Assistant IA: document search stays inside the agency, quota, roles.
begin;
set local search_path = public, extensions, tests;
select plan(10);

select tests.create_fixture();

select tests.authenticate_as(tests.id('a_staff'));
select is((select count(*)::int from public.search_chunks(tests.id('a_agency'), 'caution agence', 10)), 1,
  'staff finds the agency''s own document');
select is((select document_id from public.search_chunks(tests.id('a_agency'), 'caution', 10) limit 1), tests.id('a_doc'),
  'the chunk found belongs to the active agency');
select is((select count(*)::int from public.search_chunks(tests.id('a_agency'), 'Caution de l''agence b', 10)
            where document_id = tests.id('b_doc')), 0,
  'never another agency''s chunks, even with their exact words');
select throws_ok($$ select * from public.search_chunks(tests.id('b_agency'), 'caution', 5) $$, '42501', null,
  'cannot search another agency''s documents');
select is((select count(*)::int from public.search_chunks(tests.id('a_agency'), '?!', 5)), 0, 'empty query returns nothing');
select throws_ok($$ select * from public.stats_daily(tests.id('a_agency'), current_date, current_date) $$, '42501', null,
  'staff cannot get revenue through the assistant either');
select throws_ok(
  $$ insert into public.ai_documents (agency_id, title) values (tests.id('a_agency'), 'x') $$,
  '42501', null, 'staff cannot add documents');

insert into public.activity_log (agency_id, actor_id, action, entity, details)
values (tests.id('a_agency'), tests.id('a_staff'), 'assistant.question', 'assistant', '{"tools":[]}');
select is((select used from public.ai_quota(tests.id('a_agency'))), 1, 'a question counts towards the monthly quota');
select is((select enabled from public.ai_quota(tests.id('a_agency'))), true, 'assistant on by default');

select tests.authenticate_as(tests.id('c_outsider'));
select throws_ok($$ select * from public.ai_quota(tests.id('a_agency')) $$, '42501', null, 'outsiders cannot read the quota');

select * from finish();
rollback;
