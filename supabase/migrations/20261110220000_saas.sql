-- SaaS layer: subscription payments + invoices (manual payment first),
-- public booking page /r/{slug} with booking requests, platform helpers.

-- ---------------------------------------------------------------------------
-- Subscription payments. An admin asks for a plan (status 'pending'),
-- Parcolia confirms the payment (status 'paid', invoice number, plan active).
-- ---------------------------------------------------------------------------
create sequence public.invoice_number_seq;

create table public.subscription_payments (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  plan_id         uuid not null references public.plans(id),
  period          text not null check (period in ('month', 'year')),
  amount          numeric(12,2) not null check (amount >= 0),
  method          text not null check (method in ('virement', 'especes', 'cheque', 'carte')),
  reference       text not null unique,
  status          text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  provider        text not null default 'manual',
  provider_ref    text,
  invoice_number  text unique,
  period_start    date,
  period_end      date,
  paid_at         timestamptz,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  confirmed_by    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (agency_id, id),
  constraint paid_has_invoice check (status <> 'paid' or (invoice_number is not null and paid_at is not null))
);
create index subscription_payments_agency_idx on public.subscription_payments (agency_id, created_at desc);
create trigger set_updated_at before update on public.subscription_payments
  for each row execute function public.set_updated_at();

alter table public.subscription_payments enable row level security;
-- Admins of the agency read their payments; only Parcolia (platform) writes,
-- through the functions below or directly.
create policy subscription_payments_select on public.subscription_payments
  for select to authenticated
  using (agency_id in (select public.current_agency_ids(array['admin'])) or (select public.is_platform_admin()));
create policy subscription_payments_platform on public.subscription_payments
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

/** An admin asks for a plan: creates a pending payment with a reference to quote. */
create or replace function public.request_subscription(p_agency uuid, p_plan_code text, p_period text, p_method text)
returns table (id uuid, reference text, amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_amount numeric;
  v_ref text;
  v_id uuid;
begin
  if not public.has_role(p_agency, array['admin']) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  select * into v_plan from public.plans where code = p_plan_code and active;
  if not found then
    raise exception 'Forfait inconnu' using errcode = '22023';
  end if;
  if p_period not in ('month', 'year') or p_method not in ('virement', 'especes', 'cheque', 'carte') then
    raise exception 'Paramètres invalides' using errcode = '22023';
  end if;
  v_amount := case p_period when 'year' then v_plan.price_mad_year else v_plan.price_mad_month end;
  -- One open request at a time: a new one replaces the previous pending one.
  update public.subscription_payments set status = 'cancelled'
   where agency_id = p_agency and status = 'pending';
  v_ref := 'PAR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.subscription_payments (agency_id, plan_id, period, amount, method, reference, created_by)
  values (p_agency, v_plan.id, p_period, v_amount, p_method, v_ref, auth.uid())
  returning subscription_payments.id into v_id;
  return query select v_id, v_ref, v_amount;
end;
$$;

/**
 * Parcolia confirms a payment: invoice number, plan switched, period extended
 * from the later of today and the current end.
 */
create or replace function public.confirm_subscription_payment(p_payment uuid, p_provider_ref text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.subscription_payments%rowtype;
  v_agency public.agencies%rowtype;
  v_start date;
  v_end date;
  v_invoice text;
begin
  if (select auth.uid()) is not null and not public.is_platform_admin() then
    raise exception 'Réservé à l''équipe Parcolia' using errcode = '42501';
  end if;
  select * into v_pay from public.subscription_payments where id = p_payment for update;
  if not found or v_pay.status <> 'pending' then
    raise exception 'Paiement introuvable ou déjà traité' using errcode = '22023';
  end if;
  select * into v_agency from public.agencies where id = v_pay.agency_id for update;
  v_start := greatest((now() at time zone 'Africa/Casablanca')::date,
                      coalesce((v_agency.current_period_end at time zone 'Africa/Casablanca')::date, '-infinity'::date));
  v_end := (v_start + case v_pay.period when 'year' then interval '1 year' else interval '1 month' end)::date;
  v_invoice := 'F-' || to_char(now() at time zone 'Africa/Casablanca', 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
  update public.subscription_payments
     set status = 'paid', paid_at = now(), invoice_number = v_invoice, period_start = v_start, period_end = v_end,
         provider_ref = coalesce(p_provider_ref, provider_ref), confirmed_by = auth.uid()
   where id = p_payment;
  update public.agencies
     set plan_id = v_pay.plan_id, subscription_status = 'active',
         current_period_end = (v_end::timestamp at time zone 'Africa/Casablanca')
   where id = v_pay.agency_id;
  return v_invoice;
end;
$$;

revoke execute on function public.request_subscription(uuid, text, text, text) from public, anon;
revoke execute on function public.confirm_subscription_payment(uuid, text) from public, anon;
grant execute on function public.request_subscription(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.confirm_subscription_payment(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public booking page /r/{slug}
-- ---------------------------------------------------------------------------
alter table public.agencies
  add column public_booking_enabled boolean not null default false,
  add column public_booking_message text check (char_length(public_booking_message) <= 500);

create table public.booking_requests (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  vehicle_id    uuid,
  full_name     text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone         text not null check (char_length(phone) between 6 and 20),
  email         text check (email is null or char_length(email) <= 200),
  start_date    date not null,
  end_date      date not null,
  delivery_place text check (char_length(delivery_place) <= 200),
  message       text check (char_length(message) <= 1000),
  status        text not null default 'new' check (status in ('new', 'handled', 'declined')),
  ip_hash       text,
  handled_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint booking_dates check (end_date > start_date),
  foreign key (agency_id, vehicle_id) references public.vehicles (agency_id, id) on delete set null (vehicle_id)
);
create index booking_requests_agency_idx on public.booking_requests (agency_id, status, created_at desc);
create index booking_requests_ip_idx on public.booking_requests (ip_hash, created_at);
create trigger set_updated_at before update on public.booking_requests
  for each row execute function public.set_updated_at(); -- also keeps agency_id immutable

alter table public.booking_requests enable row level security;
-- Members handle requests. Inserts come only from the server (service role,
-- after the anti-robot check): no policy for anon at all.
create policy booking_requests_select on public.booking_requests
  for select to authenticated using (agency_id in (select public.current_agency_ids()));
create policy booking_requests_update on public.booking_requests
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids()))
  with check (agency_id in (select public.writable_agency_ids()));
create policy booking_requests_delete on public.booking_requests
  for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));

/** What the public page may show: branding and cars (no plates, no km). */
create or replace function public.public_agency(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id, 'name', a.name, 'slug', a.slug, 'logo_path', a.logo_path, 'brand_color', a.brand_color,
    'city', a.city, 'phone', a.phone, 'email', a.email, 'address', a.address,
    'message', a.public_booking_message,
    'min_driver_age', a.min_driver_age, 'default_deposit', a.default_deposit,
    'cars', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'brand_model', v.brand_model, 'category', v.category,
                                          'fuel', v.fuel, 'gearbox', v.gearbox, 'daily_rate', v.daily_rate)
                       order by v.daily_rate, v.brand_model)
      from public.vehicles v where v.agency_id = a.id and v.status = 'active'), '[]'::jsonb)
  )
  from public.agencies a
  where a.slug = lower(p_slug)
    and a.public_booking_enabled
    and public.subscription_is_writable(a.subscription_status, a.trial_ends_at, a.current_period_end);
$$;
revoke execute on function public.public_agency(text) from public;
grant execute on function public.public_agency(text) to anon, authenticated, service_role;
