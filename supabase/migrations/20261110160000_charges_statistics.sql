-- Charges (receipts, monthly recurring) and Statistiques (aggregated in SQL, admins only).

alter table public.charges
  add column receipt_path text,
  add column is_recurring boolean not null default false,
  add column recurring_parent_id uuid references public.charges(id) on delete set null,
  add constraint charges_receipt_prefix check (receipt_path is null or receipt_path like agency_id::text || '/charges/%');

create index charges_recurring_idx on public.charges (agency_id) where is_recurring;
create unique index charges_recurring_month_uidx on public.charges (recurring_parent_id, date_trunc('month', date::timestamp))
  where recurring_parent_id is not null;

-- ---------------------------------------------------------------------------
-- Monthly recurring charges: copy each template into the current month once.
-- Called by the daily job (service role) or by an admin.
-- ---------------------------------------------------------------------------
create or replace function public.generate_recurring_charges(p_agency uuid, p_month date default current_date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_first date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  t record;
begin
  for t in
    select * from public.charges c
    where c.agency_id = p_agency and c.is_recurring and c.date < v_first
  loop
    insert into public.charges (agency_id, date, category, vehicle_id, amount, campaign_name, note, recurring_parent_id, created_by)
    values (
      t.agency_id,
      least(v_first + (extract(day from t.date)::int - 1), v_last),
      t.category, t.vehicle_id, t.amount, t.campaign_name, t.note, t.id, t.created_by
    )
    on conflict do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Statistics. Revenue is attributed per rental day (Casablanca calendar),
-- so a rental across two months is split; returned rentals count to the real
-- return; the delivery fee goes to the first day. Admins only.
-- ---------------------------------------------------------------------------


create or replace function public._assert_admin(p_agency uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role(p_agency, array['admin']) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.rental_day_rows(p_agency uuid, p_from date, p_to date)
returns table (reservation_id uuid, vehicle_id uuid, day date, revenue numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public._assert_admin(p_agency);
  return query
  select r.id, r.vehicle_id,
         ((r.start_at at time zone 'Africa/Casablanca')::date + g.i)::date as day,
         r.daily_price + case when g.i = 0 then r.delivery_fee else 0 end as revenue
  from public.reservations r
  cross join lateral generate_series(
    0,
    public.rental_days(r.start_at, case when r.status = 'returned' and r.actual_return_at is not null then r.actual_return_at else r.end_at end) - 1
  ) as g(i)
  where r.agency_id = p_agency
    and r.status <> 'cancelled'
    and r.start_at < (p_to + 1)::timestamp at time zone 'Africa/Casablanca'
    and coalesce(r.actual_return_at, r.end_at) > (p_from - 1)::timestamp at time zone 'Africa/Casablanca'
    and ((r.start_at at time zone 'Africa/Casablanca')::date + g.i) between p_from and p_to;
end;
$$;

/** One row per day: revenue, charges, rented car-days. */
create or replace function public.stats_daily(p_agency uuid, p_from date, p_to date)
returns table (day date, revenue numeric, charges numeric, rented_days int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public._assert_admin(p_agency);
  return query
  with days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  rev as (
    select x.day, sum(x.revenue) as revenue, count(*)::int as rented
    from public.rental_day_rows(p_agency, p_from, p_to) x group by x.day
  ),
  ch as (
    select c.date as day, sum(c.amount) as amount from public.charges c
    where c.agency_id = p_agency and c.date between p_from and p_to group by c.date
  )
  select d.day, coalesce(rev.revenue, 0)::numeric, coalesce(ch.amount, 0)::numeric, coalesce(rev.rented, 0)
  from days d left join rev on rev.day = d.day left join ch on ch.day = d.day
  order by d.day;
end;
$$;

/** Per car: revenue, its own charges (agency charges are not split), days rented. */
create or replace function public.stats_by_vehicle(p_agency uuid, p_from date, p_to date)
returns table (vehicle_id uuid, plate text, brand_model text, revenue numeric, charges numeric, rented_days int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public._assert_admin(p_agency);
  return query
  with rev as (
    select x.vehicle_id, sum(x.revenue) as revenue, count(*)::int as rented
    from public.rental_day_rows(p_agency, p_from, p_to) x group by x.vehicle_id
  ),
  ch as (
    select c.vehicle_id, sum(c.amount) as amount from public.charges c
    where c.agency_id = p_agency and c.vehicle_id is not null and c.date between p_from and p_to group by c.vehicle_id
  )
  select v.id, v.plate, v.brand_model,
         coalesce(rev.revenue, 0)::numeric, coalesce(ch.amount, 0)::numeric, coalesce(rev.rented, 0)
  from public.vehicles v
  left join rev on rev.vehicle_id = v.id
  left join ch on ch.vehicle_id = v.id
  where v.agency_id = p_agency and (v.status = 'active' or rev.revenue is not null or ch.amount is not null);
end;
$$;

revoke execute on function public.generate_recurring_charges(uuid, date) from public, anon;
revoke execute on function public.rental_day_rows(uuid, date, date) from public, anon;
revoke execute on function public.stats_daily(uuid, date, date) from public, anon;
revoke execute on function public.stats_by_vehicle(uuid, date, date) from public, anon;
revoke execute on function public._assert_admin(uuid) from public, anon;
grant execute on function public.generate_recurring_charges(uuid, date) to authenticated, service_role;
grant execute on function public.rental_day_rows(uuid, date, date) to authenticated, service_role;
grant execute on function public.stats_daily(uuid, date, date) to authenticated, service_role;
grant execute on function public.stats_by_vehicle(uuid, date, date) to authenticated, service_role;
grant execute on function public._assert_admin(uuid) to authenticated, service_role;
