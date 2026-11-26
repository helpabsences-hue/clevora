-- Clévora — core tables: plans, agencies, profiles, members, invitations, platform admins.
-- Roles inside an agency: 'admin' (the owners, all equal) and 'staff'.

-- ---------------------------------------------------------------------------
-- plans (no agency_id) — prices live here so they can change without code
-- ---------------------------------------------------------------------------
create table public.plans (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[a-z0-9_]+$'),
  name             text not null,
  max_vehicles     int  check (max_vehicles is null or max_vehicles > 0), -- null = unlimited
  max_users        int  check (max_users is null or max_users > 0),       -- null = unlimited
  ai_enabled       boolean not null default false,
  price_mad_month  numeric(12,2) not null default 0 check (price_mad_month >= 0),
  price_mad_year   numeric(12,2) not null default 0 check (price_mad_year >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- agencies (no agency_id) — the tenant
-- ---------------------------------------------------------------------------
create table public.agencies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(btrim(name)) between 2 and 120),
  slug                    text not null unique
                          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  logo_path               text,
  brand_color             text check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  address                 text,
  city                    text,
  phone                   text,
  email                   text,
  -- Informations légales (shown on contracts)
  rc                      text,
  ice                     text,
  if_number               text,
  patente                 text,
  cnss                    text,
  contract_terms          text, -- verso of the paper contract
  default_language        text not null default 'fr' check (default_language in ('fr','ar','en')),
  -- Alertes
  alert_days_before       int  not null default 30   check (alert_days_before between 1 and 365),
  alert_km_before         int  not null default 1500 check (alert_km_before between 100 and 50000),
  -- Contrat defaults
  min_driver_age          int  not null default 21 check (min_driver_age between 18 and 99),
  min_license_years       int  not null default 2  check (min_license_years between 0 and 50),
  default_franchise       numeric(12,2) not null default 0 check (default_franchise >= 0),
  default_deposit         numeric(12,2) not null default 0 check (default_deposit >= 0), -- caution
  equipment_items         text[] not null default array[
                            'Roue de secours','Cric','Triangle','Gilet','Extincteur','Siège bébé'],
  document_items          text[] not null default array[
                            'Carte grise','Attestation d''assurance','Visite technique','Vignette'],
  -- Abonnement (only Clévora platform admins can change these: see trigger)
  plan_id                 uuid references public.plans(id),
  subscription_status     text not null default 'trial'
                          check (subscription_status in ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  -- Numérotation des contrats
  contract_number_prefix  text not null default 'C-' check (char_length(contract_number_prefix) <= 20),
  next_contract_number    int  not null default 1 check (next_contract_number >= 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint agencies_logo_path_prefix
    check (logo_path is null or logo_path like id::text || '/%')
);

-- ---------------------------------------------------------------------------
-- profiles (no agency_id) — one per auth user, created by trigger on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  phone            text,
  preferred_locale text not null default 'fr'     check (preferred_locale in ('fr','ar','en')),
  preferred_theme  text not null default 'system' check (preferred_theme in ('light','dark','system')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- agency_members — who belongs to which agency, with which role
-- ---------------------------------------------------------------------------
create table public.agency_members (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('admin','staff')),
  status      text not null default 'active' check (status in ('active','disabled')),
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agency_id, user_id)
);
create index agency_members_user_id_idx on public.agency_members (user_id);

-- ---------------------------------------------------------------------------
-- invitations — only a SHA-256 hash of the token is stored
-- ---------------------------------------------------------------------------
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  email        text check (email is null or (email = lower(email) and email like '%_@_%')),
  phone        text,
  role         text not null check (role in ('admin','staff')),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  invited_by   uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint invitations_email_or_phone check (email is not null or phone is not null)
);
create index invitations_agency_id_idx on public.invitations (agency_id);

-- ---------------------------------------------------------------------------
-- platform_admins (no agency_id) — Clévora staff, used by the /platform area
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
