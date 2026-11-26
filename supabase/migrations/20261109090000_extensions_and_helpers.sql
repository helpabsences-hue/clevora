-- Clévora — extensions and shared helpers.
-- Supabase keeps extensions in the "extensions" schema.

create schema if not exists extensions;

create extension if not exists btree_gist with schema extensions; -- no double booking (EXCLUDE on uuid + range)
create extension if not exists pg_trgm    with schema extensions; -- fast "contains" search on names and contract numbers
create extension if not exists vector     with schema extensions; -- AI assistant embeddings

-- Generic BEFORE UPDATE trigger used on every table:
--   * keeps updated_at current
--   * forbids moving a row to another agency (agency_id is immutable)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) ? 'agency_id')
     and (to_jsonb(new) ->> 'agency_id') is distinct from (to_jsonb(old) ->> 'agency_id') then
    raise exception 'Une ligne ne peut pas changer d''agence'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
