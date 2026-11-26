-- Achat et crédit of each car (admins only: it is money), and a profitability
-- report: has the car paid back what it cost, and does it pay its credit each month?

create table public.vehicle_finance (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,
  vehicle_id        uuid not null,
  purchase_date     date not null,
  purchase_price    numeric(12,2) not null check (purchase_price > 0),
  mode              text not null check (mode in ('cash', 'credit')),
  down_payment      numeric(12,2) not null default 0 check (down_payment >= 0),
  monthly_payment   numeric(12,2) check (monthly_payment > 0),
  months            integer check (months between 1 and 120),
  first_payment_on  date,
  lender            text check (char_length(lender) <= 120),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agency_id, vehicle_id),
  foreign key (agency_id, vehicle_id) references public.vehicles (agency_id, id) on delete cascade,
  constraint vehicle_finance_credit_fields check (
    mode = 'cash'
    or (monthly_payment is not null and months is not null and first_payment_on is not null)
  )
);
create trigger set_updated_at before update on public.vehicle_finance
  for each row execute function public.set_updated_at(); -- also keeps agency_id immutable

alter table public.vehicle_finance enable row level security;
create policy vehicle_finance_select on public.vehicle_finance
  for select to authenticated using (agency_id in (select public.current_agency_ids(array['admin'])));
create policy vehicle_finance_insert on public.vehicle_finance
  for insert to authenticated with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy vehicle_finance_update on public.vehicle_finance
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids(array['admin'])))
  with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy vehicle_finance_delete on public.vehicle_finance
  for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));

/**
 * One row per car that has its purchase recorded.
 *  gain          = rental revenue − charges of the car, since it was bought (up to today)
 *  total_cost    = what the car costs in the end (cash price, or apport + all monthly payments)
 *  paid_so_far   = what has really left the agency's pocket until today
 *  gain_3_months = revenue − charges over the last 3 months (to compare with the monthly payment)
 */
create or replace function public.vehicle_profitability(p_agency uuid)
returns table (
  vehicle_id uuid, plate text, brand_model text, status text,
  purchase_date date, purchase_price numeric, mode text, down_payment numeric,
  monthly_payment numeric, months int, first_payment_on date, lender text,
  months_paid int, paid_so_far numeric, credit_left numeric, total_cost numeric,
  revenue numeric, charges numeric, gain numeric, gain_3_months numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  perform public._assert_admin(p_agency);
  return query
  with f as (
    select vf.*,
      case when vf.mode = 'cash' then 0
           when v_today < vf.first_payment_on then 0
           else least(vf.months,
             (extract(year from age(v_today, vf.first_payment_on)) * 12
              + extract(month from age(v_today, vf.first_payment_on)))::int + 1)
      end as paid_months
    from public.vehicle_finance vf
    where vf.agency_id = p_agency
  ),
  start as (select coalesce(min(f.purchase_date), v_today) as d from f),
  rev as (
    select x.vehicle_id, sum(x.revenue) filter (where x.day >= f.purchase_date) as revenue,
           sum(x.revenue) filter (where x.day > v_today - 91) as revenue_3m
    from public.rental_day_rows(p_agency, (select d from start), v_today) x
    join f on f.vehicle_id = x.vehicle_id
    group by x.vehicle_id
  ),
  ch as (
    select c.vehicle_id, sum(c.amount) filter (where c.date >= f.purchase_date) as amount,
           sum(c.amount) filter (where c.date > v_today - 91) as amount_3m
    from public.charges c
    join f on f.vehicle_id = c.vehicle_id
    where c.agency_id = p_agency and c.date <= v_today
    group by c.vehicle_id
  )
  select v.id, v.plate, v.brand_model, v.status,
         f.purchase_date, f.purchase_price, f.mode, f.down_payment,
         f.monthly_payment, f.months, f.first_payment_on, f.lender,
         f.paid_months,
         (case when f.mode = 'cash' then f.purchase_price else f.down_payment + f.monthly_payment * f.paid_months end)::numeric,
         (case when f.mode = 'cash' then 0 else f.monthly_payment * (f.months - f.paid_months) end)::numeric,
         (case when f.mode = 'cash' then f.purchase_price else f.down_payment + f.monthly_payment * f.months end)::numeric,
         coalesce(rev.revenue, 0)::numeric,
         coalesce(ch.amount, 0)::numeric,
         (coalesce(rev.revenue, 0) - coalesce(ch.amount, 0))::numeric,
         (coalesce(rev.revenue_3m, 0) - coalesce(ch.amount_3m, 0))::numeric
  from f
  join public.vehicles v on v.id = f.vehicle_id and v.agency_id = p_agency
  left join rev on rev.vehicle_id = f.vehicle_id
  left join ch on ch.vehicle_id = f.vehicle_id;
end;
$$;
revoke execute on function public.vehicle_profitability(uuid) from public, anon;
grant execute on function public.vehicle_profitability(uuid) to authenticated, service_role;
