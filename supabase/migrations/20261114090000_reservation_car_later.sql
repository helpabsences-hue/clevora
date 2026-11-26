-- A reservation can be taken without choosing the car (far-off dates, "any car").
-- The car is chosen later, on the contract, before signing / starting.

alter table public.reservations alter column vehicle_id drop not null;

alter table public.reservations
  add constraint reservations_car_before_signing
  check (vehicle_id is not null or (signed_at is null and status in ('reserved', 'cancelled')));

/**
 * Choose (or change) the car of a reservation that has not started yet.
 * The double-booking rule, the maintenance guard and RLS still apply.
 * p_daily_price: new price per day, or null to keep the agreed price.
 */
create or replace function public.assign_vehicle(p_agency uuid, p_reservation uuid, p_vehicle uuid, p_daily_price numeric default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vehicles v where v.id = p_vehicle and v.agency_id = p_agency and v.status = 'active') then
    raise exception 'Voiture introuvable' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.vehicles v
    join public.reservations r on r.id = p_reservation
    where v.id = p_vehicle and v.insurance_expires_on is not null
      and v.insurance_expires_on < (r.start_at at time zone 'Africa/Casablanca')::date
  ) then
    raise exception 'Assurance expirée' using errcode = 'P0001', hint = 'vehicle_insurance_expired';
  end if;
  update public.reservations
     set vehicle_id = p_vehicle,
         daily_price = coalesce(p_daily_price, daily_price)
   where id = p_reservation and agency_id = p_agency and status = 'reserved';
  if not found then
    raise exception 'Cette réservation ne peut plus changer de voiture' using errcode = 'P0001', hint = 'reservation_not_reserved';
  end if;
end;
$$;
revoke execute on function public.assign_vehicle(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.assign_vehicle(uuid, uuid, uuid, numeric) to authenticated, service_role;
