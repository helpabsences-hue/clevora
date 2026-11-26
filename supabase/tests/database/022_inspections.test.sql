-- Inspections: staff record them; a photo must sit in its own agency folder.
begin;
set local search_path = public, extensions, tests;
select plan(8);

select tests.create_fixture();
select tests.authenticate_as(tests.id('a_staff'));

select lives_ok($$
  insert into public.inspections (agency_id, reservation_id, kind) values (tests.id('a_agency'), tests.id('a_reservation'), 'return')
$$, 'staff start the return inspection');
select throws_ok($$
  insert into public.inspections (agency_id, reservation_id, kind) values (tests.id('a_agency'), tests.id('a_reservation'), 'departure')
$$, '23505', null, 'one inspection of each kind per reservation');
select throws_ok($$
  insert into public.inspection_photos (agency_id, inspection_id, view, storage_path)
  values (tests.id('a_agency'), tests.id('a_inspection'), 'back', tests.id('b_agency')::text || '/inspections/x/back.jpg')
$$, '23514', null, 'a photo path in another agency folder is refused');
select lives_ok($$
  insert into public.inspection_damages (agency_id, inspection_id, x, y, type, source, confirmed)
  values (tests.id('a_agency'), tests.id('a_inspection'), 0.8, 0.9, 'scratch', 'ai', false)
$$, 'an AI suggestion is saved unconfirmed');
select throws_ok($$
  update public.inspections set video_path = tests.id('b_agency')::text || '/inspections/x/video' where id = tests.id('a_inspection')
$$, '23514', null, 'a video path in another agency folder is refused');
select throws_ok($$
  update public.inspections set mode = 'film' where id = tests.id('a_inspection')
$$, '23514', null, 'mode is photos or video');
select is(tests.update_rows('agencies', 'id', tests.id('a_agency')), 0, 'staff cannot change agency settings (inspection on/off)');
select is(tests.delete_rows('inspections', 'agency_id', tests.id('a_agency')), 0, 'staff cannot delete a whole inspection');

select * from finish();
rollback;
