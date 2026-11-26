-- Clévora — auth & onboarding:
--   * profiles.email (kept in sync with auth.users) so the team list can show it
--   * create_agency(name, slug, city, phone, brand_color) + create_agency_for_user (service role only)
--   * invitation_preview(token) for the accept-invitation page (works before login)
--   * read-only mode: writes are refused when the trial / paid period is over or
--     the agency is suspended / cancelled (writable_agency_ids()).

-- ---------------------------------------------------------------------------
-- profiles.email
-- ---------------------------------------------------------------------------
alter table public.profiles add column email text;

update public.profiles p set email = lower(u.email) from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, preferred_locale)
  values (
    new.id,
    lower(new.email),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    case when new.raw_user_meta_data ->> 'locale' in ('fr','ar','en')
         then new.raw_user_meta_data ->> 'locale' else 'fr' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- users cannot change their own email through the profiles table
create or replace function public.tg_profiles_protect_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and current_user in ('authenticated', 'anon') then
    raise exception 'L''adresse e-mail se change depuis le compte de connexion' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_email before update on public.profiles
  for each row execute function public.tg_profiles_protect_email();

-- ---------------------------------------------------------------------------
-- Agency creation
-- ---------------------------------------------------------------------------
drop function if exists public.create_agency(text, text);

-- Internal: create the agency, make p_user its first admin, start a 14-day Pro trial.
create or replace function public._create_agency(
  p_user uuid, p_name text, p_slug text,
  p_city text default null, p_phone text default null, p_brand_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   uuid;
  v_agency uuid;
begin
  if p_user is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  select p.id into v_plan from public.plans p where p.code = 'pro';

  insert into public.profiles (id) values (p_user) on conflict (id) do nothing;

  insert into public.agencies (name, slug, city, phone, brand_color, plan_id, subscription_status, trial_ends_at)
  values (btrim(p_name), lower(btrim(p_slug)), nullif(btrim(p_city), ''), nullif(btrim(p_phone), ''),
          nullif(btrim(p_brand_color), ''), v_plan, 'trial', now() + interval '14 days')
  returning id into v_agency;

  insert into public.agency_members (agency_id, user_id, role, status)
  values (v_agency, p_user, 'admin', 'active');

  return v_agency;
end;
$$;
revoke execute on function public._create_agency(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Logged-in user creates their own agency.
create or replace function public.create_agency(
  p_name text, p_slug text,
  p_city text default null, p_phone text default null, p_brand_color text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._create_agency(auth.uid(), p_name, p_slug, p_city, p_phone, p_brand_color);
$$;
revoke execute on function public.create_agency(text, text, text, text, text) from public, anon;
grant  execute on function public.create_agency(text, text, text, text, text) to authenticated, service_role;

-- Server only (service role): signup while the email is not confirmed yet.
create or replace function public.create_agency_for_user(
  p_user uuid, p_name text, p_slug text,
  p_city text default null, p_phone text default null, p_brand_color text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._create_agency(p_user, p_name, p_slug, p_city, p_phone, p_brand_color);
$$;
revoke execute on function public.create_agency_for_user(uuid, text, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.create_agency_for_user(uuid, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- invitation_preview: what the invite page shows before login
-- ---------------------------------------------------------------------------
create or replace function public.invitation_preview(p_token text)
returns table (
  agency_name  text,
  logo_path    text,
  brand_color  text,
  role         text,
  email        text,
  phone        text,
  state        text   -- 'valid' | 'expired' | 'used' | 'invalid'
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.name, a.logo_path, a.brand_color, i.role, i.email, i.phone,
         case when i.accepted_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'valid' end
  from public.invitations i
  join public.agencies a on a.id = i.agency_id
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  union all
  select null, null, null, null, null, null, 'invalid'
  where not exists (
    select 1 from public.invitations i
    where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  );
$$;
revoke execute on function public.invitation_preview(text) from public;
grant  execute on function public.invitation_preview(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Read-only mode
-- ---------------------------------------------------------------------------
-- trial     : writable until trial_ends_at
-- active    : writable until current_period_end (null = no end date)
-- past_due  : still writable (grace period; Clévora suspends if needed)
-- suspended / cancelled : read-only
create or replace function public.subscription_is_writable(
  p_status text, p_trial_ends_at timestamptz, p_current_period_end timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'trial'    then p_trial_ends_at is null or p_trial_ends_at > now()
    when 'active'   then p_current_period_end is null or p_current_period_end > now()
    when 'past_due' then true
    else false
  end;
$$;

-- Agencies where the current user is an active member with one of p_roles AND
-- the agency is not in read-only mode. Used by every write policy.
create or replace function public.writable_agency_ids(p_roles text[] default array['admin','staff'])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.agency_members m
  join public.agencies a on a.id = m.agency_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.role = any (p_roles)
    and public.subscription_is_writable(a.subscription_status, a.trial_ends_at, a.current_period_end);
$$;
revoke execute on function public.writable_agency_ids(text[]) from public, anon;
grant  execute on function public.writable_agency_ids(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-create every write policy with writable_agency_ids()
-- (reads keep using current_agency_ids(): data stays visible in read-only mode)
-- ---------------------------------------------------------------------------
drop policy agencies_update on public.agencies;
create policy agencies_update on public.agencies
  for update to authenticated
  using      (id in (select public.writable_agency_ids(array['admin'])) or (select public.is_platform_admin()))
  with check (id in (select public.writable_agency_ids(array['admin'])) or (select public.is_platform_admin()));

drop policy members_update on public.agency_members;
drop policy members_delete on public.agency_members;
create policy members_update on public.agency_members
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids(array['admin'])))
  with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy members_delete on public.agency_members
  for delete to authenticated
  using (agency_id in (select public.writable_agency_ids(array['admin'])));

drop policy invitations_insert on public.invitations;
drop policy invitations_update on public.invitations;
drop policy invitations_delete on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    agency_id in (select public.writable_agency_ids(array['admin']))
    and invited_by = (select auth.uid())
  );
create policy invitations_update on public.invitations
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids(array['admin'])))
  with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (agency_id in (select public.writable_agency_ids(array['admin'])));

drop policy vehicles_insert on public.vehicles;
drop policy vehicles_update on public.vehicles;
drop policy vehicles_delete on public.vehicles;
create policy vehicles_insert on public.vehicles
  for insert to authenticated with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy vehicles_update on public.vehicles
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids()))
  with check (agency_id in (select public.writable_agency_ids()));
create policy vehicles_delete on public.vehicles
  for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));

do $$
declare
  t text;
begin
  -- daily work: members write, admins delete
  foreach t in array array['maintenance_periods','clients','reservations'] loop
    execute format($f$
      drop policy %1$s_insert on public.%1$I;
      drop policy %1$s_update on public.%1$I;
      drop policy %1$s_delete on public.%1$I;
      create policy %1$s_insert on public.%1$I
        for insert to authenticated with check (agency_id in (select public.writable_agency_ids()));
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using      (agency_id in (select public.writable_agency_ids()))
        with check (agency_id in (select public.writable_agency_ids()));
      create policy %1$s_delete on public.%1$I
        for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));
    $f$, t);
  end loop;

  -- admin-managed tables
  foreach t in array array['charges','ai_documents','ai_chunks'] loop
    execute format($f$
      drop policy %1$s_insert on public.%1$I;
      drop policy %1$s_update on public.%1$I;
      drop policy %1$s_delete on public.%1$I;
      create policy %1$s_insert on public.%1$I
        for insert to authenticated with check (agency_id in (select public.writable_agency_ids(array['admin'])));
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using      (agency_id in (select public.writable_agency_ids(array['admin'])))
        with check (agency_id in (select public.writable_agency_ids(array['admin'])));
      create policy %1$s_delete on public.%1$I
        for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));
    $f$, t);
  end loop;
end;
$$;

drop policy payments_insert on public.reservation_payments;
drop policy payments_update on public.reservation_payments;
drop policy payments_delete on public.reservation_payments;
create policy payments_insert on public.reservation_payments
  for insert to authenticated with check (agency_id in (select public.writable_agency_ids()));
create policy payments_update on public.reservation_payments
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids(array['admin'])))
  with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy payments_delete on public.reservation_payments
  for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));

-- Storage writes follow the same rule
drop policy "agency-logos: admins upload" on storage.objects;
drop policy "agency-logos: admins update" on storage.objects;
drop policy "agency-logos: admins delete" on storage.objects;
create policy "agency-logos: admins upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
  );
create policy "agency-logos: admins update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
  )
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
  );
create policy "agency-logos: admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
  );

drop policy "agency-docs: upload" on storage.objects;
drop policy "agency-docs: update" on storage.objects;
drop policy "agency-docs: admins delete" on storage.objects;
create policy "agency-docs: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  );
create policy "agency-docs: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  )
  with check (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  );
create policy "agency-docs: admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-docs'
    and (storage.foldername(name))[1] in (select a::text from public.writable_agency_ids(array['admin']) a)
  );
