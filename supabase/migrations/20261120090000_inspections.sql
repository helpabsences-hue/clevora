-- Inspection départ / retour: photos per view, damage marks on a car drawing,
-- and (optional) AI suggestions that staff confirm. Photos live in the private
-- agency-docs bucket under {agency_id}/inspections/{inspection_id}/{view}.jpg.

create table public.inspections (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies(id) on delete cascade,
  reservation_id uuid not null,
  kind           text not null check (kind in ('departure', 'return')),
  notes          text check (char_length(notes) <= 1000),
  completed_at   timestamptz,
  ai_status      text not null default 'none' check (ai_status in ('none', 'running', 'done', 'failed')),
  ai_checked_at  timestamptz,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (agency_id, id),
  unique (reservation_id, kind),
  foreign key (agency_id, reservation_id) references public.reservations (agency_id, id) on delete cascade
);
create index inspections_reservation_idx on public.inspections (agency_id, reservation_id);
create trigger set_updated_at before update on public.inspections
  for each row execute function public.set_updated_at();

create table public.inspection_photos (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  inspection_id uuid not null,
  view          text not null check (view in ('front', 'back', 'left', 'right', 'wheels', 'roof', 'interior', 'trunk')),
  storage_path  text not null check (char_length(storage_path) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (inspection_id, view),
  foreign key (agency_id, inspection_id) references public.inspections (agency_id, id) on delete cascade,
  -- the file must be in this agency's folder
  constraint inspection_photos_path check (split_part(storage_path, '/', 1) = agency_id::text)
);
create trigger set_updated_at before update on public.inspection_photos
  for each row execute function public.set_updated_at();

create table public.inspection_damages (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  inspection_id uuid not null,
  -- position on the top-view drawing, 0..1 from the top-left corner
  x             numeric(5,4) not null check (x between 0 and 1),
  y             numeric(5,4) not null check (y between 0 and 1),
  type          text not null check (type in ('scratch', 'dent', 'glass', 'tyre', 'interior', 'missing', 'other')),
  view          text check (view in ('front', 'back', 'left', 'right', 'wheels', 'roof', 'interior', 'trunk')),
  note          text check (char_length(note) <= 300),
  source        text not null default 'staff' check (source in ('staff', 'ai')),
  -- AI suggestions stay unconfirmed until a person checks them
  confirmed     boolean not null default true,
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (agency_id, inspection_id) references public.inspections (agency_id, id) on delete cascade
);
create index inspection_damages_inspection_idx on public.inspection_damages (agency_id, inspection_id);
create trigger set_updated_at before update on public.inspection_damages
  for each row execute function public.set_updated_at();

-- Daily work: every member records inspections; only admins delete a whole inspection.
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.inspection_damages enable row level security;

create policy inspections_select on public.inspections for select to authenticated
  using (agency_id in (select public.current_agency_ids()));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (agency_id in (select public.writable_agency_ids()));
create policy inspections_update on public.inspections for update to authenticated
  using (agency_id in (select public.writable_agency_ids()))
  with check (agency_id in (select public.writable_agency_ids()));
create policy inspections_delete on public.inspections for delete to authenticated
  using (agency_id in (select public.writable_agency_ids(array['admin'])));

do $$
declare t text;
begin
  foreach t in array array['inspection_photos', 'inspection_damages'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (agency_id in (select public.current_agency_ids()));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (agency_id in (select public.writable_agency_ids()));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (agency_id in (select public.writable_agency_ids()))
        with check (agency_id in (select public.writable_agency_ids()));
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (agency_id in (select public.writable_agency_ids()));
    $f$, t);
  end loop;
end;
$$;
