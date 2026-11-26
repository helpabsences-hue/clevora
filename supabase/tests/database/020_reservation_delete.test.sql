-- Deleting reservations: admins only, and only reservations that never started.
begin;
set local search_path = public, extensions, tests;
select plan(5);

select tests.create_fixture();

insert into public.reservations (id, agency_id, vehicle_id, client_id, start_at, end_at, daily_price, contract_number)
values ('aaaaaaaa-0000-4000-8000-0000000020a1', tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'), now() + interval '60 days', now() + interval '62 days', 300, 'DEL-1'),
       ('aaaaaaaa-0000-4000-8000-0000000020a2', tests.id('a_agency'), tests.id('a_vehicle'), tests.id('a_client'), now() + interval '70 days', now() + interval '72 days', 300, 'DEL-2');
insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
values (tests.id('a_agency'), 'aaaaaaaa-0000-4000-8000-0000000020a2', 200, 'cash', 'advance');

select tests.authenticate_as(tests.id('a_staff'));
delete from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a1';
select tests.authenticate_as(tests.id('a_admin'));
select is((select count(*)::int from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a1'), 1, 'staff cannot delete a reservation');

select tests.authenticate_as(tests.id('b_admin'));
delete from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a1';
select tests.authenticate_as(tests.id('a_admin'));
select is((select count(*)::int from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a1'), 1, 'another agency cannot delete it');

select lives_ok($$ delete from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a1' $$, 'an admin deletes a reservation that never started');
select throws_ok($$ delete from public.reservations where id = 'aaaaaaaa-0000-4000-8000-0000000020a2' $$, 'P0001', null, 'not when money was received');
select throws_ok($$ delete from public.reservations where id = tests.id('a_reservation') $$, 'P0001', null, 'not a contract that started');

select * from finish();
rollback;
