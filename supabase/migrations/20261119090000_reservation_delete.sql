-- Deleting reservations (admins): only those that never started.
-- A signed contract, a rental that began or a reservation with money received is
-- a legal / money record: it can be cancelled, never deleted.

create or replace function public.reservation_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Removed together with its agency (delete_agency → foreign key cascade): allowed.
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if old.status not in ('reserved', 'cancelled')
     or old.signed_at is not null
     or exists (select 1 from public.reservation_payments p where p.reservation_id = old.id and p.agency_id = old.agency_id) then
    raise exception 'Cette réservation ne peut pas être supprimée (contrat signé, location commencée ou argent reçu).'
      using errcode = 'P0001', hint = 'reservation_not_deletable';
  end if;
  return old;
end;
$$;

create trigger reservation_delete_guard before delete on public.reservations
  for each row execute function public.reservation_delete_guard();

-- The delete policy itself (admins, writable agency) already exists since the
-- auth_onboarding migration; this trigger adds the "never started" rule on top.
