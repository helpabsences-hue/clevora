-- Clévora — business functions (contract numbers, agency creation, invitations, AI search).

-- ---------------------------------------------------------------------------
-- Contract numbers
-- ---------------------------------------------------------------------------

-- Internal: lock the agency row, return prefix + number, increment.
-- Skips numbers already typed by hand (paper contracts) so they never collide.
-- Not callable by clients: used by the reservations trigger and next_contract_number().
create or replace function public._next_contract_number(p_agency uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix    text;
  v_n         int;
  v_candidate text;
begin
  select a.contract_number_prefix, a.next_contract_number
    into v_prefix, v_n
  from public.agencies a
  where a.id = p_agency
  for update;

  if not found then
    raise exception 'Agence introuvable' using errcode = 'P0002';
  end if;

  loop
    v_candidate := v_prefix || v_n::text;
    exit when not exists (
      select 1 from public.reservations r
      where r.agency_id = p_agency and r.contract_number = v_candidate
    );
    v_n := v_n + 1;
  end loop;

  update public.agencies set next_contract_number = v_n + 1 where id = p_agency;
  return v_candidate;
end;
$$;
revoke execute on function public._next_contract_number(uuid) from public, anon, authenticated;

-- Public: take the next number for the caller's agency (consumes it).
create or replace function public.next_contract_number(p_agency uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_agency) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return public._next_contract_number(p_agency);
end;
$$;
revoke execute on function public.next_contract_number(uuid) from public, anon;
grant  execute on function public.next_contract_number(uuid) to authenticated, service_role;

-- Public: show the next number as a placeholder WITHOUT consuming it.
create or replace function public.preview_contract_number(p_agency uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prefix    text;
  v_n         int;
  v_candidate text;
begin
  if not public.is_member(p_agency) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select a.contract_number_prefix, a.next_contract_number into v_prefix, v_n
  from public.agencies a where a.id = p_agency;

  loop
    v_candidate := v_prefix || v_n::text;
    exit when not exists (
      select 1 from public.reservations r
      where r.agency_id = p_agency and r.contract_number = v_candidate
    );
    v_n := v_n + 1;
  end loop;
  return v_candidate;
end;
$$;
revoke execute on function public.preview_contract_number(uuid) from public, anon;
grant  execute on function public.preview_contract_number(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_agency: agency + caller as admin + 14-day trial on Pro, one transaction
-- ---------------------------------------------------------------------------
create or replace function public.create_agency(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_plan   uuid;
  v_agency uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  select p.id into v_plan from public.plans p where p.code = 'pro';

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.agencies (name, slug, plan_id, subscription_status, trial_ends_at)
  values (btrim(p_name), lower(btrim(p_slug)), v_plan, 'trial', now() + interval '14 days')
  returning id into v_agency;

  insert into public.agency_members (agency_id, user_id, role, status)
  values (v_agency, v_uid, 'admin', 'active');

  return v_agency;
end;
$$;
revoke execute on function public.create_agency(text, text) from public, anon;
grant  execute on function public.create_agency(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- accept_invitation: the raw token travels in the email link; we store its hash
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.invitations;
  v_email  text;
  v_max    int;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Invitation invalide ou expirée' using errcode = 'P0001';
  end if;

  if v_inv.email is not null then
    select lower(u.email) into v_email from auth.users u where u.id = v_uid;
    if v_email is distinct from v_inv.email then
      raise exception 'Cette invitation a été envoyée à une autre adresse e-mail' using errcode = '42501';
    end if;
  end if;

  -- Plan limit on users (null = unlimited)
  select p.max_users into v_max
  from public.agencies a left join public.plans p on p.id = a.plan_id
  where a.id = v_inv.agency_id
  for update of a;

  if v_max is not null then
    select count(*) into v_count
    from public.agency_members m
    where m.agency_id = v_inv.agency_id and m.status = 'active' and m.user_id <> v_uid;
    if v_count >= v_max then
      raise exception 'Limite d''utilisateurs atteinte pour ce forfait' using errcode = 'P0001',
        hint = 'plan_limit_users';
    end if;
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.agency_members (agency_id, user_id, role, status, invited_by)
  values (v_inv.agency_id, v_uid, v_inv.role, 'active', v_inv.invited_by)
  on conflict (agency_id, user_id) do update set role = excluded.role, status = 'active';

  update public.invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  return v_inv.agency_id;
end;
$$;
revoke execute on function public.accept_invitation(text) from public, anon;
grant  execute on function public.accept_invitation(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- match_chunks: AI document search. Filters by agency FIRST, runs with the
-- caller's rights (RLS applies too) and refuses non-members.
-- ---------------------------------------------------------------------------
create or replace function public.match_chunks(
  p_agency uuid,
  p_query_embedding extensions.vector,
  p_k int default 5
)
returns table (id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_member(p_agency) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select c.id, c.document_id, c.content, c.metadata,
         1 - (c.embedding operator(extensions.<=>) p_query_embedding) as similarity
  from public.ai_chunks c
  where c.agency_id = p_agency
    and c.embedding is not null
  order by c.embedding operator(extensions.<=>) p_query_embedding
  limit least(greatest(coalesce(p_k, 5), 1), 20);
end;
$$;
revoke execute on function public.match_chunks(uuid, extensions.vector, int) from public, anon;
grant  execute on function public.match_chunks(uuid, extensions.vector, int) to authenticated, service_role;
