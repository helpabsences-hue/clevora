-- Réservations: totals, search, infraction finder, availability, atomic save and return.
-- All functions run with the caller's rights (security invoker): RLS still applies.

-- A rental can only start once the contract is signed.
alter table public.reservations
  add constraint reservations_signed_before_rental
  check (status not in ('on_rental', 'returned') or signed_at is not null);

-- ---------------------------------------------------------------------------
-- Totals per reservation. Days: each started 24 h counts (minimum 1).
-- Returned rentals are counted to the real return time.
-- ---------------------------------------------------------------------------
create or replace function public.rental_days(p_start timestamptz, p_end timestamptz)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(1, ceil(extract(epoch from (p_end - p_start)) / 86400 - 1e-9)::int);
$$;

create or replace view public.reservation_totals
with (security_invoker = true)
as
select
  r.id,
  r.agency_id,
  public.rental_days(r.start_at, r.end_at) as planned_days,
  public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end) as days,
  (public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end)
    * r.daily_price + r.delivery_fee)::numeric(12,2) as total,
  coalesce((select sum(p.amount) from public.reservation_payments p
            where p.reservation_id = r.id and p.kind in ('advance', 'balance', 'extra')), 0)::numeric(12,2) as paid,
  ((public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end)
    * r.daily_price + r.delivery_fee)
   - coalesce((select sum(p.amount) from public.reservation_payments p
               where p.reservation_id = r.id and p.kind in ('advance', 'balance', 'extra')), 0))::numeric(12,2) as balance
from public.reservations r;

grant select on public.reservation_totals to authenticated;

-- ---------------------------------------------------------------------------
-- Search: contract number, plate, client name, CIN/passport, phone (both drivers)
-- ---------------------------------------------------------------------------
create or replace function public.search_reservation_ids(p_agency uuid, p_q text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as text_q,
      upper(regexp_replace(coalesce(p_q, ''), '[\s\-./|]', '', 'g')) as norm_q,
      -- phone digits without the national 0 ("0612…" also finds "+212612…")
      regexp_replace(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '^0', '') as digits_q
  )
  select r.id
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  join public.clients c on c.id = r.client_id
  left join public.clients c2 on c2.id = r.second_driver_id
  cross join q
  where r.agency_id = p_agency
    and length(q.text_q) >= 2
    and (
      r.contract_number ilike '%' || q.text_q || '%'
      or v.plate_norm like '%' || q.norm_q || '%'
      or c.full_name ilike '%' || q.text_q || '%'
      or c2.full_name ilike '%' || q.text_q || '%'
      or c.id_number_norm like '%' || q.norm_q || '%'
      or c2.id_number_norm like '%' || q.norm_q || '%'
      or (length(q.digits_q) >= 4 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.digits_q || '%')
      or (length(q.digits_q) >= 4 and regexp_replace(coalesce(c2.phone, ''), '\D', '', 'g') like '%' || q.digits_q || '%')
    )
  order by r.start_at desc
  limit 200;
$$;

-- ---------------------------------------------------------------------------
-- Infraction finder: who had this car between p_from and p_to?
-- A rental covers [start_at, real return or planned end].
-- ---------------------------------------------------------------------------
create or replace function public.who_had_car(p_agency uuid, p_plate text, p_from timestamptz, p_to timestamptz)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.agency_id = p_agency
    and v.plate_norm = upper(regexp_replace(coalesce(p_plate, ''), '[\s\-./|]', '', 'g'))
    and r.status in ('on_rental', 'returned')
    and tstzrange(r.start_at, coalesce(r.actual_return_at, greatest(r.end_at, case when r.status = 'on_rental' then now() else r.end_at end)), '[]')
        && tstzrange(p_from, p_to, '[]')
  order by r.start_at;
$$;

-- ---------------------------------------------------------------------------
-- Which cars can be booked from p_start to p_end? reason null = available,
-- otherwise 'booked' | 'maintenance' | 'insurance' | 'sold'.
-- ---------------------------------------------------------------------------
create or replace function public.vehicle_availability(
  p_agency uuid, p_start timestamptz, p_end timestamptz, p_exclude_reservation uuid default null
)
returns table (vehicle_id uuid, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id,
    case
      when v.status = 'sold' then 'sold'
      when exists (
        select 1 from public.reservations r
        where r.vehicle_id = v.id
          and r.status in ('reserved', 'on_rental')
          and r.id is distinct from p_exclude_reservation
          and tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_start, p_end, '[)')
      ) then 'booked'
      when exists (
        select 1 from public.maintenance_periods m
        where m.vehicle_id = v.id
          and public.maintenance_blocked_days(m.starts_on, m.expected_end_on, m.ended_on)
              && public.reservation_days(p_start, p_end)
      ) then 'maintenance'
      when v.insurance_expires_on is not null
           and v.insurance_expires_on < (p_end at time zone 'Africa/Casablanca')::date then 'insurance'
      else null
    end
  from public.vehicles v
  where v.agency_id = p_agency;
$$;

-- ---------------------------------------------------------------------------
-- Save a reservation in one transaction: drivers (created or updated by
-- CIN/passport), the reservation, and the advance / deposit payments.
-- p_reservation null = new reservation.
-- ---------------------------------------------------------------------------
create or replace function public._upsert_client(p_agency uuid, p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.clients (
    agency_id, id_type, id_number, full_name, phone, email, nationality, address,
    birth_date, birth_place, id_expires_on, id_issued_on, id_issued_place,
    license_number, license_issued_on, license_issued_place
  ) values (
    p_agency, p ->> 'id_type', btrim(p ->> 'id_number'), btrim(p ->> 'full_name'),
    nullif(p ->> 'phone', ''), nullif(p ->> 'email', ''), nullif(p ->> 'nationality', ''), nullif(p ->> 'address', ''),
    nullif(p ->> 'birth_date', '')::date, nullif(p ->> 'birth_place', ''),
    nullif(p ->> 'id_expires_on', '')::date, nullif(p ->> 'id_issued_on', '')::date, nullif(p ->> 'id_issued_place', ''),
    nullif(p ->> 'license_number', ''), nullif(p ->> 'license_issued_on', '')::date, nullif(p ->> 'license_issued_place', '')
  )
  on conflict (agency_id, id_type, id_number_norm) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    nationality = excluded.nationality,
    address = excluded.address,
    birth_date = excluded.birth_date,
    birth_place = excluded.birth_place,
    id_expires_on = excluded.id_expires_on,
    id_issued_on = excluded.id_issued_on,
    id_issued_place = excluded.id_issued_place,
    license_number = excluded.license_number,
    license_issued_on = excluded.license_issued_on,
    license_issued_place = excluded.license_issued_place
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_reservation(p_agency uuid, p_reservation uuid, p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client uuid;
  v_driver2 uuid;
  v_id uuid;
begin
  v_client := public._upsert_client(p_agency, p -> 'driver1');
  if jsonb_typeof(p -> 'driver2') = 'object' then
    v_driver2 := public._upsert_client(p_agency, p -> 'driver2');
  end if;

  if p_reservation is null then
    insert into public.reservations (
      agency_id, contract_number, vehicle_id, client_id, second_driver_id,
      start_at, end_at, delivery, delivery_place, return_place, delivery_fee,
      daily_price, franchise, deposit_taken, deposit_amount,
      km_out, fuel_out, equipment, documents_given, notes
    ) values (
      p_agency, coalesce(p ->> 'contract_number', ''), (p ->> 'vehicle_id')::uuid, v_client, v_driver2,
      (p ->> 'start_at')::timestamptz, (p ->> 'end_at')::timestamptz,
      coalesce((p ->> 'delivery')::boolean, false), nullif(p ->> 'delivery_place', ''), nullif(p ->> 'return_place', ''),
      coalesce((p ->> 'delivery_fee')::numeric, 0),
      (p ->> 'daily_price')::numeric, coalesce((p ->> 'franchise')::numeric, 0),
      coalesce((p ->> 'deposit_taken')::boolean, false), coalesce((p ->> 'deposit_amount')::numeric, 0),
      nullif(p ->> 'km_out', '')::int, nullif(p ->> 'fuel_out', '')::smallint,
      coalesce(array(select jsonb_array_elements_text(p -> 'equipment')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p -> 'documents_given')), '{}'),
      nullif(p ->> 'notes', '')
    )
    returning id into v_id;

    if coalesce((p -> 'advance' ->> 'amount')::numeric, 0) > 0 then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
      values (p_agency, v_id, (p -> 'advance' ->> 'amount')::numeric, p -> 'advance' ->> 'method', 'advance');
    end if;
    if coalesce((p ->> 'deposit_taken')::boolean, false) and coalesce((p ->> 'deposit_amount')::numeric, 0) > 0 then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, note)
      values (p_agency, v_id, (p ->> 'deposit_amount')::numeric, coalesce(p ->> 'deposit_method', 'cash'), 'deposit', 'Caution');
    end if;
  else
    update public.reservations set
      contract_number = coalesce(nullif(p ->> 'contract_number', ''), contract_number),
      vehicle_id = (p ->> 'vehicle_id')::uuid,
      client_id = v_client,
      second_driver_id = v_driver2,
      start_at = (p ->> 'start_at')::timestamptz,
      end_at = (p ->> 'end_at')::timestamptz,
      delivery = coalesce((p ->> 'delivery')::boolean, false),
      delivery_place = nullif(p ->> 'delivery_place', ''),
      return_place = nullif(p ->> 'return_place', ''),
      delivery_fee = coalesce((p ->> 'delivery_fee')::numeric, 0),
      daily_price = (p ->> 'daily_price')::numeric,
      franchise = coalesce((p ->> 'franchise')::numeric, 0),
      deposit_taken = coalesce((p ->> 'deposit_taken')::boolean, false),
      deposit_amount = coalesce((p ->> 'deposit_amount')::numeric, 0),
      km_out = nullif(p ->> 'km_out', '')::int,
      fuel_out = nullif(p ->> 'fuel_out', '')::smallint,
      equipment = coalesce(array(select jsonb_array_elements_text(p -> 'equipment')), '{}'),
      documents_given = coalesce(array(select jsonb_array_elements_text(p -> 'documents_given')), '{}'),
      notes = nullif(p ->> 'notes', '')
    where id = p_reservation and agency_id = p_agency and status = 'reserved'
    returning id into v_id;
    if v_id is null then
      raise exception 'Seule une réservation pas encore partie peut être modifiée'
        using errcode = 'P0001', hint = 'reservation_not_editable';
    end if;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Return of the car: km in, fuel in, real return time, car km, payments.
-- ---------------------------------------------------------------------------
create or replace function public.return_reservation(p_agency uuid, p_reservation uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vehicle uuid;
  v_km int := nullif(p ->> 'km_in', '')::int;
begin
  update public.reservations set
    status = 'returned',
    actual_return_at = coalesce((p ->> 'actual_return_at')::timestamptz, now()),
    km_in = v_km,
    fuel_in = nullif(p ->> 'fuel_in', '')::smallint,
    notes = coalesce(nullif(p ->> 'notes', ''), notes)
  where id = p_reservation and agency_id = p_agency and status = 'on_rental'
  returning vehicle_id into v_vehicle;
  if v_vehicle is null then
    raise exception 'Cette location n''est pas en cours' using errcode = 'P0001', hint = 'reservation_not_on_rental';
  end if;

  if v_km is not null then
    update public.vehicles set current_km = greatest(current_km, v_km) where id = v_vehicle;
  end if;

  if coalesce((p -> 'balance' ->> 'amount')::numeric, 0) > 0 then
    insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind)
    values (p_agency, p_reservation, (p -> 'balance' ->> 'amount')::numeric, p -> 'balance' ->> 'method', 'balance');
  end if;
  if coalesce((p -> 'deposit_refund' ->> 'amount')::numeric, 0) > 0 then
    insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, note)
    values (p_agency, p_reservation, (p -> 'deposit_refund' ->> 'amount')::numeric, p -> 'deposit_refund' ->> 'method', 'deposit_refund', 'Caution rendue');
  end if;
end;
$$;

revoke execute on function public._upsert_client(uuid, jsonb) from public, anon;
revoke execute on function public.save_reservation(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.return_reservation(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.search_reservation_ids(uuid, text) from public, anon;
revoke execute on function public.who_had_car(uuid, text, timestamptz, timestamptz) from public, anon;
revoke execute on function public.vehicle_availability(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public._upsert_client(uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_reservation(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.return_reservation(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.search_reservation_ids(uuid, text) to authenticated, service_role;
grant execute on function public.who_had_car(uuid, text, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.vehicle_availability(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

create index if not exists reservations_agency_status_idx on public.reservations (agency_id, status, end_at);
