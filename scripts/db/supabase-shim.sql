-- TEST-ONLY stand-in for the parts of Supabase that our migrations rely on.
-- Used by supabase/tests/run-local.sh on a plain Postgres (no Docker).
-- NEVER apply this to a real Supabase project: it already has all of this.

-- Roles used by PostgREST / Supabase
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Default grants like Supabase: API roles get table privileges, RLS decides rows.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth schema (subset of GoTrue's)
-- ---------------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id             uuid,
  id                      uuid primary key,
  aud                     varchar(255),
  role                    varchar(255),
  email                   varchar(255),
  encrypted_password      varchar(255),
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb,
  raw_user_meta_data      jsonb,
  phone                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  confirmation_token      varchar(255),
  recovery_token          varchar(255),
  email_change_token_new  varchar(255),
  email_change            varchar(255)
);

create table if not exists auth.identities (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  identity_data    jsonb not null,
  provider         text not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  email            text generated always as (lower(identity_data ->> 'email')) stored,
  unique (provider_id, provider)
);

-- Same definitions as Supabase: read the JWT claims set by PostgREST.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- storage schema (subset of Supabase Storage's)
-- ---------------------------------------------------------------------------
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null unique,
  owner               uuid,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists storage.objects (
  id                uuid primary key default gen_random_uuid(),
  bucket_id         text references storage.buckets(id),
  name              text,
  owner             uuid,
  metadata          jsonb,
  path_tokens       text[] generated always as (string_to_array(name, '/')) stored,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  last_accessed_at  timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
