-- Clévora — business tables. Every table has agency_id.
-- Child rows reference their parent with (agency_id, id) so a row can never
-- point to a car, client or reservation of another agency.

-- ---------------------------------------------------------------------------
-- vehicles — Parc auto. The displayed status (Disponible, En location…) is
-- computed by the app; only 'active' / 'sold' is stored.
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id                          uuid primary key default gen_random_uuid(),
  agency_id                   uuid not null references public.agencies(id) on delete cascade,
  plate                       text not null check (char_length(btrim(plate)) between 2 and 20), -- matricule
  -- normalised matricule: uppercase, no spaces, dashes, dots, slashes or bars
  plate_norm                  text generated always as
                              (upper(regexp_replace(plate, '[\s\-./|]', '', 'g'))) stored,
  brand_model                 text not null check (char_length(btrim(brand_model)) between 1 and 120),
  category                    text not null check (category in ('economy','compact','suv','van','luxury')),
  fuel                        text not null check (fuel in ('essence','diesel','hybride','electrique')),
  gearbox                     text not null check (gearbox in ('manuelle','automatique')),
  daily_rate                  numeric(12,2) not null check (daily_rate >= 0),
  current_km                  int not null default 0 check (current_km >= 0),
  first_registration_date     date,
  insurer                     text,
  policy_number               text,
  insurance_expires_on        date,
  technical_visit_expires_on  date,
  oil_last_km                 int check (oil_last_km >= 0),
  oil_last_date               date,
  oil_next_km                 int check (oil_next_km >= 0),
  status                      text not null default 'active' check (status in ('active','sold')),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, plate_norm)
);
-- (agency_id, plate_norm) is covered by the unique index above.

-- ---------------------------------------------------------------------------
-- maintenance_periods — a car is blocked only between starts_on and its end
-- ---------------------------------------------------------------------------
create table public.maintenance_periods (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id) on delete cascade,
  vehicle_id       uuid not null,
  reason           text not null check (reason in ('panne','accident','carrosserie','pneus','entretien','autre')),
  starts_on        date not null default current_date,
  expected_end_on  date,
  ended_on         date,
  note             text,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (agency_id, vehicle_id) references public.vehicles (agency_id, id) on delete cascade,
  check (expected_end_on is null or expected_end_on >= starts_on),
  check (ended_on is null or ended_on >= starts_on)
);
create index maintenance_periods_agency_id_idx on public.maintenance_periods (agency_id);
create index maintenance_periods_open_idx on public.maintenance_periods (agency_id, vehicle_id)
  where ended_on is null;

-- ---------------------------------------------------------------------------
-- clients — belong to exactly one agency, never shared
-- ---------------------------------------------------------------------------
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies(id) on delete cascade,
  full_name             text not null check (char_length(btrim(full_name)) between 1 and 160),
  phone                 text,
  email                 text,
  nationality           text,
  address               text,
  birth_date            date,
  birth_place           text,
  id_type               text not null check (id_type in ('cin','passport')),
  id_number             text not null check (char_length(btrim(id_number)) between 2 and 40),
  -- normalised CIN / passport: uppercase, no spaces, dashes or dots
  id_number_norm        text generated always as
                        (upper(regexp_replace(id_number, '[\s\-.]', '', 'g'))) stored,
  id_expires_on         date,
  id_issued_on          date,
  id_issued_place       text,
  license_number        text, -- permis
  license_issued_on     date,
  license_issued_place  text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, id_type, id_number_norm)
);
create index clients_agency_id_number_norm_idx on public.clients (agency_id, id_number_norm);
create index clients_full_name_trgm_idx on public.clients using gin (full_name extensions.gin_trgm_ops);
create index clients_agency_phone_idx on public.clients (agency_id, phone);

-- ---------------------------------------------------------------------------
-- reservations — also the contract (contract_number, signed_at)
-- ---------------------------------------------------------------------------
create table public.reservations (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references public.agencies(id) on delete cascade,
  -- empty => filled by next_contract_number() in a BEFORE INSERT trigger
  contract_number    text not null default '' check (char_length(contract_number) between 1 and 40),
  vehicle_id         uuid not null,
  client_id          uuid not null,   -- conducteur 1
  second_driver_id   uuid,            -- conducteur 2
  status             text not null default 'reserved'
                     check (status in ('reserved','on_rental','returned','cancelled')),
  start_at           timestamptz not null,
  end_at             timestamptz not null,
  actual_return_at   timestamptz,
  delivery           boolean not null default false, -- livraison
  delivery_place     text,
  return_place       text,
  delivery_fee       numeric(12,2) not null default 0 check (delivery_fee >= 0),
  daily_price        numeric(12,2) not null check (daily_price >= 0),
  advance_paid       numeric(12,2) not null default 0 check (advance_paid >= 0), -- avance (kept in sync with payments)
  franchise          numeric(12,2) not null default 0 check (franchise >= 0),
  deposit_taken      boolean not null default false,                              -- caution
  deposit_amount     numeric(12,2) not null default 0 check (deposit_amount >= 0),
  km_out             int check (km_out >= 0),
  km_in              int check (km_in >= 0),
  fuel_out           smallint check (fuel_out between 0 and 4), -- in quarters: 0 = vide, 4 = plein
  fuel_in            smallint check (fuel_in between 0 and 4),
  equipment          text[] not null default '{}',
  documents_given    text[] not null default '{}',
  notes              text,
  signed_at          timestamptz,
  signed_by          uuid references public.profiles(id) on delete set null,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_by         uuid default auth.uid() references public.profiles(id) on delete set null,
  extended_days      int not null default 0 check (extended_days >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (agency_id, id),
  unique (agency_id, contract_number),
  foreign key (agency_id, vehicle_id)       references public.vehicles (agency_id, id),
  foreign key (agency_id, client_id)        references public.clients  (agency_id, id),
  foreign key (agency_id, second_driver_id) references public.clients  (agency_id, id),
  constraint reservations_dates_check  check (end_at > start_at),
  constraint reservations_drivers_check check (second_driver_id is null or second_driver_id <> client_id),
  constraint reservations_km_check     check (km_in is null or km_out is null or km_in >= km_out),
  -- No double booking: same car, overlapping period, active status.
  -- '[)' bounds: a car returned at 10:00 can leave again at 10:00.
  constraint reservations_no_double_booking exclude using gist (
    vehicle_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('reserved','on_rental'))
);
create index reservations_agency_start_idx on public.reservations (agency_id, start_at);
create index reservations_agency_end_idx   on public.reservations (agency_id, end_at);
create index reservations_vehicle_idx      on public.reservations (agency_id, vehicle_id, start_at);
create index reservations_client_idx       on public.reservations (agency_id, client_id);
create index reservations_second_driver_idx on public.reservations (agency_id, second_driver_id)
  where second_driver_id is not null;
create index reservations_contract_trgm_idx on public.reservations
  using gin (contract_number extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- reservation_payments — the real record of money received / refunded
-- ---------------------------------------------------------------------------
create table public.reservation_payments (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  reservation_id  uuid not null,
  amount          numeric(12,2) not null check (amount > 0),
  method          text not null check (method in ('cash','card','transfer','cheque')),
  kind            text not null check (kind in ('advance','balance','deposit','deposit_refund','extra')),
  paid_at         timestamptz not null default now(),
  note            text,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (agency_id, reservation_id) references public.reservations (agency_id, id) on delete cascade
);
create index reservation_payments_agency_idx on public.reservation_payments (agency_id, paid_at);
create index reservation_payments_reservation_idx on public.reservation_payments (reservation_id);

-- ---------------------------------------------------------------------------
-- charges — expenses (admin only). vehicle_id null = charge de l'agence
-- ---------------------------------------------------------------------------
create table public.charges (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies(id) on delete cascade,
  date           date not null default current_date,
  category       text not null check (category in
                   ('carburant','lavage','vidange','reparation','assurance','visite',
                    'publicite','salaires','loyer','autre')),
  vehicle_id     uuid,
  amount         numeric(12,2) not null check (amount > 0),
  campaign_name  text,
  note           text,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (agency_id, vehicle_id) references public.vehicles (agency_id, id),
  constraint charges_campaign_only_for_ads check (campaign_name is null or category = 'publicite')
);
create index charges_agency_date_idx on public.charges (agency_id, date);
create index charges_vehicle_idx on public.charges (agency_id, vehicle_id) where vehicle_id is not null;

-- ---------------------------------------------------------------------------
-- AI assistant knowledge (RAG)
-- ---------------------------------------------------------------------------
create table public.ai_documents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  title         text not null,
  source        text not null default 'upload' check (source in ('upload','system')),
  storage_path  text,
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (agency_id, id),
  constraint ai_documents_storage_prefix
    check (storage_path is null or storage_path like agency_id::text || '/%')
);
create index ai_documents_agency_idx on public.ai_documents (agency_id);

create table public.ai_chunks (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  document_id  uuid not null,
  content      text not null,
  embedding    extensions.vector(1536),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (agency_id, document_id) references public.ai_documents (agency_id, id) on delete cascade
);
create index ai_chunks_agency_idx on public.ai_chunks (agency_id);
create index ai_chunks_document_idx on public.ai_chunks (document_id);
create index ai_chunks_embedding_hnsw_idx on public.ai_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- activity_log — insert-only journal (who did what, when)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  actor_id    uuid default auth.uid() references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index activity_log_agency_created_idx on public.activity_log (agency_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (agency_id, entity, entity_id);
