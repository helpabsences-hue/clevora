-- Settings: admins edit their agency; deleting an agency needs its exact name and wipes only it.
begin;
set local search_path = public, extensions, tests;
select plan(8);

select tests.create_fixture();
create temp table b_before as select tests.agency_fingerprint(tests.id('b_agency')) as fp;
grant select on b_before to authenticated;

select tests.authenticate_as(tests.id('a_staff'));
update public.agencies set name = 'Pirate' where id = tests.id('a_agency');
reset role;
select is((select name from public.agencies where id = tests.id('a_agency')), 'Agence A', 'staff cannot change the agency settings');
select tests.authenticate_as(tests.id('a_staff'));
select throws_ok($$ select public.delete_agency(tests.id('a_agency'), 'Agence A') $$, '42501', null, 'staff cannot delete the agency');

select tests.authenticate_as(tests.id('a_admin'));
update public.agencies set alert_days_before = 15, ai_enabled = false where id = tests.id('a_agency');
reset role;
select is((select alert_days_before from public.agencies where id = tests.id('a_agency')), 15, 'an admin can change alerts and switch the assistant off');
select tests.authenticate_as(tests.id('a_admin'));
select throws_ok($$ select public.delete_agency(tests.id('b_agency'), 'Agence B') $$, '42501', null, 'cannot delete another agency');
select throws_ok($$ select public.delete_agency(tests.id('a_agency'), 'Agence') $$, '22023', null, 'the typed name must match');

select tests.authenticate_as(tests.id('a_admin'));
select lives_ok($$ select public.delete_agency(tests.id('a_agency'), '  agence a ') $$, 'an admin deletes the agency with its name');
reset role;
select is((select count(*)::int from public.reservations where agency_id = tests.id('a_agency')), 0, 'its data is gone');
select is(tests.agency_fingerprint(tests.id('b_agency')), (select fp from b_before), 'the other agency is untouched');

select * from finish();
rollback;
