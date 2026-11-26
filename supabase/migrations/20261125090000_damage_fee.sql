-- Damages found at return: a fee kept from the caution, never more than the
-- franchise of the contract. What the caution does not cover stays to pay.

alter table public.reservations
  add column damage_fee numeric(12,2) not null default 0,
  add column damage_note text check (char_length(damage_note) <= 500),
  add constraint reservations_damage_fee check (damage_fee >= 0 and damage_fee <= franchise);

-- The fee is part of what the client owes (same columns, damage_fee added at the end).
create or replace view public.reservation_totals
with (security_invoker = true)
as
select
  r.id,
  r.agency_id,
  public.rental_days(r.start_at, r.end_at) as planned_days,
  public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end) as days,
  (public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end)
    * r.daily_price + r.delivery_fee + r.damage_fee)::numeric(12,2) as total,
  coalesce((select sum(p.amount) from public.reservation_payments p
            where p.reservation_id = r.id and p.kind in ('advance', 'balance', 'extra')), 0)::numeric(12,2) as paid,
  ((public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end)
    * r.daily_price + r.delivery_fee + r.damage_fee)
   - coalesce((select sum(p.amount) from public.reservation_payments p
               where p.reservation_id = r.id and p.kind in ('advance', 'balance', 'extra')), 0))::numeric(12,2) as balance,
  r.damage_fee
from public.reservations r;

grant select on public.reservation_totals to authenticated;

-- Return: same as before, plus p.damage = { amount, note }. The part of the fee
-- the caution covers is recorded as a payment « Retenu sur la caution ».
create or replace function public.return_reservation(p_agency uuid, p_reservation uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vehicle uuid;
  v_km int := nullif(p ->> 'km_in', '')::int;
  v_fee numeric := round(coalesce((p -> 'damage' ->> 'amount')::numeric, 0), 2);
  v_refund numeric := coalesce((p -> 'deposit_refund' ->> 'amount')::numeric, 0);
  v_res record;
  v_kept numeric;
  v_method text;
begin
  select franchise, deposit_taken, deposit_amount into v_res
    from public.reservations where id = p_reservation and agency_id = p_agency and status = 'on_rental';
  if not found then
    raise exception 'Cette location n''est pas en cours' using errcode = 'P0001', hint = 'reservation_not_on_rental';
  end if;
  if v_fee < 0 or v_fee > v_res.franchise then
    raise exception 'Les frais de dégâts ne peuvent pas dépasser la franchise' using errcode = 'P0001', hint = 'damage_over_franchise';
  end if;
  v_kept := least(v_fee, case when v_res.deposit_taken then v_res.deposit_amount else 0 end);
  if v_refund > 0 and v_refund > (case when v_res.deposit_taken then v_res.deposit_amount else 0 end) - v_kept then
    raise exception 'La caution rendue dépasse ce qui reste de la caution' using errcode = 'P0001', hint = 'refund_too_high';
  end if;

  update public.reservations set
    status = 'returned',
    actual_return_at = coalesce((p ->> 'actual_return_at')::timestamptz, now()),
    km_in = v_km,
    fuel_in = nullif(p ->> 'fuel_in', '')::smallint,
    notes = coalesce(nullif(p ->> 'notes', ''), notes),
    damage_fee = v_fee,
    damage_note = case when v_fee > 0 then nullif(p -> 'damage' ->> 'note', '') else null end
  where id = p_reservation and agency_id = p_agency and status = 'on_rental'
  returning vehicle_id into v_vehicle;

  if v_km is not null then
    update public.vehicles set current_km = greatest(current_km, v_km) where id = v_vehicle;
  end if;

  if v_kept > 0 then
    -- Same way of paying as the caution itself when it was recorded
    select method into v_method from public.reservation_payments
      where reservation_id = p_reservation and kind = 'deposit' order by paid_at desc limit 1;
    insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, note)
    values (p_agency, p_reservation, v_kept, coalesce(v_method, 'cash'), 'extra', 'Retenu sur la caution (dégâts)');
  end if;
  if coalesce((p -> 'balance' ->> 'amount')::numeric, 0) > 0 then
    insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
    values (p_agency, p_reservation, (p -> 'balance' ->> 'amount')::numeric, p -> 'balance' ->> 'method', 'balance');
  end if;
  if v_refund > 0 then
    insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, note)
    values (p_agency, p_reservation, v_refund, p -> 'deposit_refund' ->> 'method', 'deposit_refund', 'Caution rendue');
  end if;
end;
$$;
