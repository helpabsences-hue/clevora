-- Loi 09-08 (CNDP): right to erasure and retention of clients' personal data.
-- Anonymizing keeps the reservations and the money (accounting) but removes
-- everything that identifies the person.

alter table public.clients add column anonymized_at timestamptz;

create or replace function public._anonymize_client_row(p_client uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clients c set
    full_name = 'Client anonymisé',
    phone = null, email = null, nationality = null, address = null,
    birth_date = null, birth_place = null,
    id_number = 'ANON-' || replace(c.id::text, '-', ''),
    id_expires_on = null, id_issued_on = null, id_issued_place = null,
    license_number = null, license_issued_on = null, license_issued_place = null,
    notes = null, anonymized_at = now()
  where c.id = p_client;
$$;
revoke execute on function public._anonymize_client_row(uuid) from public, anon, authenticated;

/** One client, on request (admins). Refused while a rental is booked or running. */
create or replace function public.anonymize_client(p_agency uuid, p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(p_agency, array['admin']) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = p_client and agency_id = p_agency) then
    raise exception 'Client introuvable' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.reservations r
    where r.agency_id = p_agency and r.status in ('reserved', 'on_rental')
      and (r.client_id = p_client or r.second_driver_id = p_client)
  ) then
    raise exception 'Location en cours ou à venir' using errcode = '22023', hint = 'client_active';
  end if;
  perform public._anonymize_client_row(p_client);
  insert into public.activity_log (agency_id, actor_id, action, entity, entity_id, details)
  values (p_agency, auth.uid(), 'client.anonymized', 'client', p_client, '{}'::jsonb);
end;
$$;

/** Clients with no rental for p_years (count only, or do it). Admins. */
create or replace function public.old_clients(p_agency uuid, p_years int)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.clients c
  where c.agency_id = p_agency
    and c.anonymized_at is null
    and c.created_at < now() - make_interval(years => p_years)
    and public.has_role(p_agency, array['admin'])
    and not exists (
      select 1 from public.reservations r
      where r.agency_id = p_agency
        and (r.client_id = c.id or r.second_driver_id = c.id)
        and (r.status in ('reserved', 'on_rental') or coalesce(r.actual_return_at, r.end_at) > now() - make_interval(years => p_years))
    );
$$;

create or replace function public.anonymize_old_clients(p_agency uuid, p_years int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  if not public.has_role(p_agency, array['admin']) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_years < 1 or p_years > 20 then
    raise exception 'Durée invalide' using errcode = '22023';
  end if;
  for v_id in select * from public.old_clients(p_agency, p_years) loop
    perform public._anonymize_client_row(v_id);
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    insert into public.activity_log (agency_id, actor_id, action, entity, details)
    values (p_agency, auth.uid(), 'clients.retention', 'client', jsonb_build_object('count', v_count, 'years', p_years));
  end if;
  return v_count;
end;
$$;

revoke execute on function public.anonymize_client(uuid, uuid) from public, anon;
revoke execute on function public.old_clients(uuid, int) from public, anon;
revoke execute on function public.anonymize_old_clients(uuid, int) from public, anon;
grant execute on function public.anonymize_client(uuid, uuid) to authenticated, service_role;
grant execute on function public.old_clients(uuid, int) to authenticated, service_role;
grant execute on function public.anonymize_old_clients(uuid, int) to authenticated, service_role;
