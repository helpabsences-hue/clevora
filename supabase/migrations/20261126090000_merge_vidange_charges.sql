-- One vidange = one charge. Vidanges saved before were split into one charge per
-- item ("Vidange à 50 000 km · Huile moteur", "… · Filtre à air"…). Merge each group
-- (same car, same date, same "Vidange à X km") into ONE charge: the total, and the
-- items in the detail. Only the old one-item notes are touched.

create temporary table vidange_groups on commit drop as
select
  agency_id,
  vehicle_id,
  date,
  split_part(note, ' · ', 1) as head,
  (array_agg(id order by created_at, id))[1] as keep_id,
  array_agg(id) as ids,
  sum(amount) as total,
  string_agg(split_part(note, ' · ', 2), ', ' order by created_at, id) as detail
from public.charges
where category = 'vidange'
  and note ~ '^Vidange à [0-9  ]+ km · [^·]+$'
  and note !~ ' MAD$'
  and receipt_path is null
  and not is_recurring
  and recurring_parent_id is null
group by agency_id, vehicle_id, date, split_part(note, ' · ', 1)
having count(*) > 1;

update public.charges c
   set amount = g.total,
       note = left(g.head || ' · ' || g.detail, 500)
  from vidange_groups g
 where c.id = g.keep_id;

delete from public.charges c
 using vidange_groups g
 where c.id = any (g.ids) and c.id <> g.keep_id;
