-- Vidange history: what was changed at each oil change (huile, filtres, chaîne…).
-- Staff and admins record it; the prices become Charges (admins only, in the app).

create table public.oil_changes (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  vehicle_id  uuid not null,
  date        date not null default current_date,
  km          integer not null check (km between 0 and 5000000),
  next_km     integer check (next_km is null or next_km > km),
  items       text[] not null default '{}'
              check (items <@ array['huile','filtre_huile','filtre_air','filtre_carburant','filtre_habitacle',
                                    'courroie','bougies','plaquettes','liquide_refroidissement','autre']::text[]),
  note        text check (char_length(note) <= 300),
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (agency_id, vehicle_id) references public.vehicles (agency_id, id) on delete cascade
);
create index oil_changes_vehicle_idx on public.oil_changes (agency_id, vehicle_id, date desc);
create trigger set_updated_at before update on public.oil_changes
  for each row execute function public.set_updated_at(); -- also keeps agency_id immutable

alter table public.oil_changes enable row level security;
create policy oil_changes_select on public.oil_changes
  for select to authenticated using (agency_id in (select public.current_agency_ids()));
create policy oil_changes_insert on public.oil_changes
  for insert to authenticated with check (agency_id in (select public.writable_agency_ids()));
-- Corrections and deletions: admins only
create policy oil_changes_update on public.oil_changes
  for update to authenticated
  using      (agency_id in (select public.writable_agency_ids(array['admin'])))
  with check (agency_id in (select public.writable_agency_ids(array['admin'])));
create policy oil_changes_delete on public.oil_changes
  for delete to authenticated using (agency_id in (select public.writable_agency_ids(array['admin'])));
