-- Parc auto: a car in maintenance cannot be booked during the maintenance dates.
--
-- A maintenance period blocks the calendar days
--   [starts_on, ended_on)                    once the car is back in service (ended_on = day it came back)
--   [starts_on, expected_end_on] inclusive   while it is still in the garage with an expected date
--   [starts_on, ∞)                           while it is in the garage with no expected date
-- Days are Casablanca calendar days.

create or replace function public.maintenance_blocked_days(p_starts_on date, p_expected_end_on date, p_ended_on date)
returns daterange
language sql
immutable
set search_path = ''
as $$
  select case
    when p_ended_on is not null then daterange(p_starts_on, greatest(p_ended_on, p_starts_on), '[)')
    when p_expected_end_on is not null then daterange(p_starts_on, p_expected_end_on, '[]')
    else daterange(p_starts_on, null, '[)')
  end;
$$;

/** Calendar days (Casablanca) used by a reservation: departure day to return day, both included. */
create or replace function public.reservation_days(p_start_at timestamptz, p_end_at timestamptz)
returns daterange
language sql
immutable
set search_path = ''
as $$
  select daterange(
    (p_start_at at time zone 'Africa/Casablanca')::date,
    (p_end_at at time zone 'Africa/Casablanca')::date,
    '[]'
  );
$$;

create or replace function public.tg_reservations_maintenance_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.status not in ('reserved', 'on_rental') then
    return new;
  end if;
  select m.reason into v_reason
  from public.maintenance_periods m
  where m.vehicle_id = new.vehicle_id
    and public.maintenance_blocked_days(m.starts_on, m.expected_end_on, m.ended_on)
        && public.reservation_days(new.start_at, new.end_at)
  limit 1;
  if found then
    raise exception 'Cette voiture est en maintenance (%) sur ces dates', v_reason
      using errcode = 'P0001', hint = 'vehicle_in_maintenance';
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_reservations_maintenance_guard() from public, anon, authenticated;

create trigger maintenance_guard
  before insert or update of vehicle_id, start_at, end_at, status on public.reservations
  for each row execute function public.tg_reservations_maintenance_guard();

create index if not exists maintenance_periods_vehicle_dates_idx
  on public.maintenance_periods (vehicle_id, starts_on);
