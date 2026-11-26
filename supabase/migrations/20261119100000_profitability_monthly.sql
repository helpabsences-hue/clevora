-- Rentabilité par voiture: this month's rent, charges and credit payment
-- (replaces the 3-month average gain).

drop function if exists public.vehicle_profitability(uuid);

create or replace function public.vehicle_profitability(p_agency uuid)
returns table (
  vehicle_id uuid, plate text, brand_model text, status text,
  purchase_date date, purchase_price numeric, mode text, down_payment numeric,
  monthly_payment numeric, months int, first_payment_on date, lender text,
  months_paid int, paid_so_far numeric, credit_left numeric, total_cost numeric,
  revenue numeric, charges numeric, gain numeric,
  revenue_month numeric, charges_month numeric, credit_month numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
  v_month date := date_trunc('month', (now() at time zone 'Africa/Casablanca'))::date;
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
      end as paid_months,
      -- a monthly payment falls in the current month while the credit runs
      (vf.mode = 'credit'
        and vf.first_payment_on < (v_month + interval '1 month')::date
        and (vf.first_payment_on + make_interval(months => vf.months - 1))::date >= v_month) as pays_this_month
    from public.vehicle_finance vf
    where vf.agency_id = p_agency
  ),
  start as (select least(coalesce(min(f.purchase_date), v_today), v_month) as d from f),
  rev as (
    select x.vehicle_id,
           sum(x.revenue) filter (where x.day >= f.purchase_date) as revenue,
           sum(x.revenue) filter (where x.day >= v_month) as revenue_month
    from public.rental_day_rows(p_agency, (select d from start), v_today) x
    join f on f.vehicle_id = x.vehicle_id
    group by x.vehicle_id
  ),
  ch as (
    select c.vehicle_id,
           sum(c.amount) filter (where c.date >= f.purchase_date) as amount,
           sum(c.amount) filter (where c.date >= v_month) as amount_month
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
         coalesce(rev.revenue_month, 0)::numeric,
         coalesce(ch.amount_month, 0)::numeric,
         (case when f.pays_this_month then f.monthly_payment else 0 end)::numeric
  from f
  join public.vehicles v on v.id = f.vehicle_id and v.agency_id = p_agency
  left join rev on rev.vehicle_id = f.vehicle_id
  left join ch on ch.vehicle_id = f.vehicle_id;
end;
$$;
revoke execute on function public.vehicle_profitability(uuid) from public, anon;
grant execute on function public.vehicle_profitability(uuid) to authenticated, service_role;
