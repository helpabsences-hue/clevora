-- Privacy (loi 09-08): anonymize one client or old clients; admins only; money kept.
begin;
set local search_path = public, extensions, tests;
select plan(9);

select tests.create_fixture();
-- Fixture: a_client has a reservation; a_client2 has none.
reset role;
update public.reservations set status = 'returned', signed_at = now() - interval '3 days', actual_return_at = now() - interval '1 day' where id = tests.id('a_reservation');
update public.clients set created_at = now() - interval '6 years' where id = tests.id('a_client2');

select tests.authenticate_as(tests.id('a_staff'));
select throws_ok($$ select public.anonymize_client(tests.id('a_agency'), tests.id('a_client')) $$, '42501', null, 'staff cannot anonymize');
select tests.authenticate_as(tests.id('b_admin'));
select throws_ok($$ select public.anonymize_client(tests.id('a_agency'), tests.id('a_client')) $$, '42501', null, 'another agency cannot');

select tests.authenticate_as(tests.id('a_admin'));
select lives_ok($$ select public.anonymize_client(tests.id('a_agency'), tests.id('a_client')) $$, 'an admin anonymizes a client');
select is((select full_name from public.clients where id = tests.id('a_client')), 'Client anonymisé', 'name removed');
select is((select phone from public.clients where id = tests.id('a_client')), null, 'phone removed');
select is((select count(*)::int from public.reservations where client_id = tests.id('a_client')), 1, 'the reservation (money) is kept');

select is((select count(*)::int from public.old_clients(tests.id('a_agency'), 5)), 1, 'one client without rental for 5 years');
select is(public.anonymize_old_clients(tests.id('a_agency'), 5), 1, 'retention anonymizes it');

reset role;
update public.reservations set status = 'reserved' where id = tests.id('b_reservation');
select tests.authenticate_as(tests.id('b_admin'));
select throws_ok($$ select public.anonymize_client(tests.id('b_agency'), tests.id('b_client')) $$, '22023', null, 'refused while a rental is booked');

select * from finish();
rollback;
