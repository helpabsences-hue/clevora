-- Parcolia — demo seed (LOCAL and STAGING only — NEVER run on production).
-- All names, phone numbers, plates and CIN/passport numbers below are FAKE.
--
-- Demo logins (local only):
--   admin@demo.parcolia.ma / Demo-Parcolia-2026   (admin)
--   staff@demo.parcolia.ma / Demo-Parcolia-2026   (staff)
--
-- Dates are relative to "today" in Africa/Casablanca, so the demo always looks
-- alive: 40 reservations from 90 days ago to 14 days ahead, 6 months of
-- charges, one car in maintenance, one late return, one insurance expired,
-- alerts for insurance / visite / vidange.

do $seed$
declare
  c_agency   constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_admin    constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  c_staff    constant uuid := 'd0000000-0000-4000-8000-0000000000a2';
  c_platform constant uuid := 'd0000000-0000-4000-8000-0000000000e1';
  v_doc      uuid;
  v_today    date := (now() at time zone 'Africa/Casablanca')::date;
  v_pro      uuid;
  v_vehicle  uuid[] := '{}';
  v_rate     numeric[] := '{}';
  v_km       int[] := '{}';
  v_client   uuid[] := '{}';
  v_id       uuid;
  v_res      uuid;
  v_start    timestamptz;
  v_end      timestamptz;
  v_price    numeric;
  v_total    numeric;
  v_advance  numeric;
  v_deposit  numeric;
  v_fee      numeric;
  v_km_in    int;
  v_month    date;
  m          int;
  i          int;
  r          record;
begin
  select id into v_pro from public.plans where code = 'pro';

  -- -------------------------------------------------------------------------
  -- Users (auth.users + identities so they can log in on local Supabase)
  -- -------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', c_admin, 'authenticated', 'authenticated',
     'admin@demo.parcolia.ma', extensions.crypt('Demo-Parcolia-2026', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Yassine Bennani (démo)","phone":"+212600000001"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', c_staff, 'authenticated', 'authenticated',
     'staff@demo.parcolia.ma', extensions.crypt('Demo-Parcolia-2026', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Salma Idrissi (démo)","phone":"+212600000002"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', c_platform, 'authenticated', 'authenticated',
     'platform@demo.parcolia.ma', extensions.crypt('Demo-Parcolia-2026', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Équipe Parcolia (démo)"}',
     now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), c_admin, c_admin::text,
     jsonb_build_object('sub', c_admin::text, 'email', 'admin@demo.parcolia.ma', 'email_verified', true),
     'email', now(), now(), now()),
    (gen_random_uuid(), c_staff, c_staff::text,
     jsonb_build_object('sub', c_staff::text, 'email', 'staff@demo.parcolia.ma', 'email_verified', true),
     'email', now(), now(), now()),
    (gen_random_uuid(), c_platform, c_platform::text,
     jsonb_build_object('sub', c_platform::text, 'email', 'platform@demo.parcolia.ma', 'email_verified', true),
     'email', now(), now(), now());
  -- Parcolia staff (local demo only): opens /platform
  insert into public.platform_admins (user_id) values (c_platform);
  -- profiles are created by the on_auth_user_created trigger

  -- -------------------------------------------------------------------------
  -- Agence Démo
  -- -------------------------------------------------------------------------
  insert into public.agencies (id, name, slug, brand_color, address, city, phone, email,
                               rc, ice, if_number, patente, cnss, contract_terms,
                               plan_id, subscription_status, trial_ends_at,
                               default_franchise, default_deposit,
                               contract_number_prefix, next_contract_number)
  values (c_agency, 'Agence Démo', 'agence-demo', '#0F4C81',
          '12 Rue Exemple, Quartier Démo', 'Casablanca', '+212522000000', 'contact@demo.parcolia.ma',
          'RC-DEMO-0001', '000000000000001', 'IF-DEMO-01', 'PAT-DEMO-01', 'CNSS-DEMO-01',
          E'1. Le locataire doit être titulaire d''un permis valide depuis au moins 2 ans.\n'
          || E'2. Le véhicule est rendu avec le même niveau de carburant qu''au départ.\n'
          || E'3. Toute infraction commise pendant la location est à la charge du locataire.\n'
          || E'4. La caution est restituée au retour du véhicule, après vérification.',
          v_pro, 'trial', now() + interval '14 days',
          5000, 3000, 'C-', 1001);

  insert into public.agency_members (agency_id, user_id, role, status, invited_by)
  values (c_agency, c_admin, 'admin', 'active', null),
         (c_agency, c_staff, 'staff', 'active', c_admin);

  -- -------------------------------------------------------------------------
  -- Parc auto: 12 cars (fake plates)
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ( 1, '12345-A-6', 'Dacia Logan',        'economy', 'diesel',  'manuelle',     250, 92000, 2021,  180,  200),
      ( 2, '23456-B-6', 'Dacia Sandero',      'economy', 'essence', 'manuelle',     250, 64000, 2022,  150,  240),
      ( 3, '34567-A-1', 'Renault Clio 5',     'compact', 'diesel',  'manuelle',     300, 71000, 2022,   25,  210),
      ( 4, '45678-D-6', 'Peugeot 208',        'compact', 'essence', 'automatique',  350, 38000, 2023,  220,  300),
      ( 5, '56789-H-6', 'Hyundai Accent',     'compact', 'diesel',  'automatique',  350, 55000, 2022,   95,  120),
      ( 6, '67890-A-6', 'Volkswagen Polo',    'compact', 'diesel',  'manuelle',     320, 83000, 2021,  160,   20),
      ( 7, '11223-B-1', 'Dacia Duster',       'suv',     'diesel',  'manuelle',     450, 47000, 2023,  250,  280),
      ( 8, '22334-A-6', 'Hyundai Tucson',     'suv',     'diesel',  'automatique',  700, 61000, 2022,  130,  190),
      ( 9, '33445-D-1', 'Peugeot 3008',       'suv',     'diesel',  'automatique',  750, 29000, 2024,  300,  340),
      (10, '44556-A-6', 'Renault Kangoo',     'van',     'diesel',  'manuelle',     400, 112000, 2020,  75,   90),
      (11, '55667-H-6', 'Mercedes Classe C',  'luxury',  'diesel',  'automatique', 1200, 41000, 2023,  200,  260),
      (12, '66778-B-1', 'Kia Picanto',        'economy', 'essence', 'manuelle',     220, 99000, 2020,   -5,   60)
    ) as t(n, plate, model, category, fuel, gearbox, rate, km, year, ins_days, visite_days)
    order by n
  loop
    insert into public.vehicles (agency_id, plate, brand_model, category, fuel, gearbox, daily_rate,
                                 current_km, first_registration_date,
                                 insurer, policy_number,
                                 insurance_expires_on, technical_visit_expires_on)
    values (c_agency, r.plate, r.model, r.category, r.fuel, r.gearbox, r.rate,
            r.km, make_date(r.year, 1 + (r.n % 12), 10),
            case when r.n % 3 = 0 then 'Assurance Démo' end,
            case when r.n % 3 = 0 then 'POL-DEMO-' || lpad(r.n::text, 4, '0') end,
            v_today + r.ins_days, v_today + r.visite_days)
    returning id into v_id;
    v_vehicle := v_vehicle || v_id;
    v_rate    := v_rate || r.rate::numeric;
    v_km      := v_km || (r.km - 6000);   -- km before the 90 days of demo rentals
  end loop;

  -- -------------------------------------------------------------------------
  -- 25 clients (fake names, fake CIN / passport numbers)
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ( 1, 'Karim Alaoui',        'cin',      'ZZ900001', 'Marocaine', 'Casablanca', 1985),
      ( 2, 'Fatima Zahra Berrada','cin',      'ZZ900002', 'Marocaine', 'Rabat',      1990),
      ( 3, 'Omar Chraibi',        'cin',      'ZZ900003', 'Marocaine', 'Fès',        1978),
      ( 4, 'Nadia El Fassi',      'cin',      'ZZ900004', 'Marocaine', 'Marrakech',  1993),
      ( 5, 'Hamza Tazi',          'cin',      'ZZ900005', 'Marocaine', 'Tanger',     1996),
      ( 6, 'Imane Lahlou',        'cin',      'ZZ900006', 'Marocaine', 'Casablanca', 1988),
      ( 7, 'Mehdi Benjelloun',    'cin',      'ZZ900007', 'Marocaine', 'Agadir',     1982),
      ( 8, 'Sara Amrani',         'cin',      'ZZ900008', 'Marocaine', 'Meknès',     1999),
      ( 9, 'Youssef Kettani',     'cin',      'ZZ900009', 'Marocaine', 'Oujda',      1975),
      (10, 'Khadija Senhaji',     'cin',      'ZZ900010', 'Marocaine', 'Kénitra',    1991),
      (11, 'Anas Filali',         'cin',      'ZZ900011', 'Marocaine', 'Tétouan',    1997),
      (12, 'Leila Bouzidi',       'cin',      'ZZ900012', 'Marocaine', 'El Jadida',  1987),
      (13, 'Rachid Ouazzani',     'cin',      'ZZ900013', 'Marocaine', 'Safi',       1980),
      (14, 'Zineb Hajji',         'cin',      'ZZ900014', 'Marocaine', 'Casablanca', 1995),
      (15, 'Adil Mansouri',       'cin',      'ZZ900015', 'Marocaine', 'Béni Mellal',1984),
      (16, 'Houda Naciri',        'cin',      'ZZ900016', 'Marocaine', 'Rabat',      1992),
      (17, 'Soufiane Raji',       'cin',      'ZZ900017', 'Marocaine', 'Nador',      1998),
      (18, 'Meryem Squalli',      'cin',      'ZZ900018', 'Marocaine', 'Casablanca', 1989),
      (19, 'Tarik Zouhair',       'cin',      'ZZ900019', 'Marocaine', 'Laâyoune',   1983),
      (20, 'Ghita Benkirane',     'cin',      'ZZ900020', 'Marocaine', 'Mohammedia', 1994),
      (21, 'Ilyas Cherkaoui',     'cin',      'ZZ900021', 'Marocaine', 'Settat',     2000),
      (22, 'Hajar Moussaoui',     'cin',      'ZZ900022', 'Marocaine', 'Khouribga',  1986),
      (23, 'Julien Martin',       'passport', 'XX0000023','Française', 'Lyon',       1981),
      (24, 'Emma Dupont',         'passport', 'XX0000024','Française', 'Paris',      1990),
      (25, 'Lucas Romero',        'passport', 'XX0000025','Espagnole', 'Séville',    1987)
    ) as t(n, full_name, id_type, id_number, nationality, city, birth_year)
    order by n
  loop
    insert into public.clients (agency_id, full_name, phone, email, nationality, address,
                                birth_date, birth_place, id_type, id_number,
                                id_expires_on, id_issued_on, id_issued_place,
                                license_number, license_issued_on, license_issued_place)
    values (c_agency, r.full_name,
            '+2126000001' || lpad(r.n::text, 2, '0'),
            case when r.n % 4 = 0 then 'client' || r.n || '@example.com' end,
            r.nationality,
            r.n || ' Rue Fictive, ' || r.city,
            make_date(r.birth_year, 1 + (r.n % 12), 1 + (r.n % 27)),
            r.city, r.id_type, r.id_number,
            v_today + (365 * (1 + r.n % 6)), v_today - (365 * (4 + r.n % 5)), r.city,
            'PDEMO' || lpad(r.n::text, 5, '0'),
            make_date(r.birth_year + 19 + (r.n % 5), 3, 15), r.city)
    returning id into v_id;
    v_client := v_client || v_id;
  end loop;

  -- -------------------------------------------------------------------------
  -- Maintenance: one car in the garage now, two finished periods
  -- -------------------------------------------------------------------------
  insert into public.maintenance_periods (agency_id, vehicle_id, reason, starts_on, expected_end_on, ended_on, note, created_by)
  values
    (c_agency, v_vehicle[10], 'panne',       v_today - 2,   v_today + 3,  null,          'Embrayage à changer', c_staff),
    (c_agency, v_vehicle[4],  'entretien',   v_today - 100, v_today - 98, v_today - 98,  'Révision complète',   c_admin),
    (c_agency, v_vehicle[7],  'carrosserie', v_today - 40,  v_today - 37, v_today - 36,  'Rayure porte arrière',c_staff);

  -- -------------------------------------------------------------------------
  -- 40 reservations (chronological per car, no overlaps)
  --   veh, start offset (days), duration (days), start hour, status,
  --   client, second driver (0 = none), delivery, manual contract number
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ( 1, -88, 5, 10, 'returned',   1,  0, false, null),
      ( 1, -60, 7,  9, 'returned',   2,  3, false, null),
      ( 1, -30, 4, 11, 'returned',   4,  0, true,  null),
      ( 1,  -3, 5, 10, 'on_rental',  5,  0, false, null),
      ( 1,   6, 4, 10, 'reserved',   6,  0, false, null),
      ( 2, -85, 3,  9, 'returned',   7,  0, false, null),
      ( 2, -55, 6, 14, 'returned',   8,  0, true,  null),
      ( 2, -20, 5, 10, 'returned',   9, 10, false, 'P-0457'),
      ( 2,  -2, 4, 12, 'on_rental', 11,  0, false, null),
      ( 2,   5, 3,  9, 'reserved',  12,  0, true,  null),
      ( 3, -80,10, 10, 'returned',  23,  0, true,  null),
      ( 3, -38, 6,  9, 'returned',  13,  0, false, null),
      ( 3,  -1, 3, 16, 'on_rental', 14,  0, false, null),
      ( 3,   8, 6, 10, 'reserved',  24, 25, true,  null),
      ( 4, -75, 4, 10, 'returned',  15,  0, false, null),
      ( 4, -45, 7, 11, 'returned',  16,  0, false, null),
      ( 4,  -6, 5,  9, 'on_rental', 17,  0, false, null),   -- en retard (fin hier)
      ( 5, -70, 6, 10, 'returned',  18,  0, false, null),
      ( 5, -35, 5,  9, 'returned',  19,  0, false, null),
      ( 5,  -4, 4, 17, 'on_rental', 20,  0, false, null),   -- retour aujourd'hui 17:00
      ( 6, -66, 3, 10, 'returned',  21,  0, false, null),
      ( 6, -25, 6, 12, 'returned',  22,  0, true,  null),
      ( 6,  -5, 6, 10, 'on_rental',  1,  0, false, null),   -- retour demain
      ( 7, -62, 8,  9, 'returned',   2,  0, false, null),
      ( 7, -18, 4, 10, 'returned',   3,  0, false, null),
      ( 7,   1, 4,  9, 'reserved',   4,  0, true,  null),   -- départ demain, livraison
      ( 7,   9, 5, 10, 'reserved',   5,  0, false, null),
      ( 8, -58, 5, 10, 'returned',   6,  0, false, null),
      ( 8, -12, 3, 14, 'returned',   7,  0, false, null),
      ( 8,   0, 3, 15, 'reserved',   8,  9, false, null),   -- départ aujourd'hui
      ( 9, -50, 4, 10, 'returned',  10,  0, false, null),
      ( 9, -10, 5,  9, 'returned',  11,  0, true,  null),
      ( 9,   2, 6, 10, 'reserved',  12,  0, false, null),
      ( 9,  10, 4, 10, 'reserved',  13,  0, false, null),
      (10, -48, 7,  9, 'returned',  14,  0, false, null),
      (10, -14, 6, 10, 'returned',  15,  0, false, null),
      (11, -42, 3, 10, 'returned',  16,  0, true,  null),
      (11,  -8, 2, 11, 'cancelled', 17,  0, false, null),
      (11,   4, 3, 10, 'reserved',  18,  0, true,  null),
      (12, -90, 4, 10, 'returned',  19,  0, false, null)
    ) as t(veh, start_off, days, hour, status, client, driver2, delivery, contract)
    order by start_off, veh
  loop
    v_start := ((v_today + r.start_off) + make_time(r.hour, 0, 0)) at time zone 'Africa/Casablanca';
    v_end   := v_start + make_interval(days => r.days);
    v_price := case when r.days >= 7 then round(v_rate[r.veh] * 0.9) else v_rate[r.veh] end;
    v_fee   := case when r.delivery then 150 else 0 end;
    v_total := v_price * r.days + v_fee;
    v_advance := round(v_total * 0.3 / 50) * 50;
    v_deposit := case when v_rate[r.veh] >= 450 then 5000 else 3000 end;
    v_km_in := v_km[r.veh] + r.days * (120 + (r.veh * 17) % 90);

    insert into public.reservations (
      agency_id, contract_number, vehicle_id, client_id, second_driver_id, status,
      start_at, end_at, actual_return_at,
      delivery, delivery_place, return_place, delivery_fee,
      daily_price, franchise, deposit_taken, deposit_amount,
      km_out, km_in, fuel_out, fuel_in,
      equipment, documents_given, notes,
      signed_at, signed_by, cancelled_at, cancel_reason, created_by)
    values (
      c_agency, coalesce(r.contract, ''), v_vehicle[r.veh], v_client[r.client],
      case when r.driver2 > 0 then v_client[r.driver2] end,
      -- create cancelled ones as 'reserved' first? no: cancelled rows never block, insert directly
      r.status,
      v_start, v_end,
      case when r.status = 'returned' then v_end - interval '1 hour' end,
      r.delivery,
      case when r.delivery then 'Aéroport Mohammed V' end,
      case when r.delivery then 'Agence' end,
      v_fee,
      v_price, 5000, r.status <> 'cancelled', case when r.status <> 'cancelled' then v_deposit else 0 end,
      case when r.status in ('on_rental','returned') then v_km[r.veh] end,
      case when r.status = 'returned' then v_km_in end,
      case when r.status in ('on_rental','returned') then 4 end,
      case when r.status = 'returned' then 3 + (r.veh % 2) end,
      case when r.status in ('on_rental','returned')
           then array['Roue de secours','Cric','Triangle','Gilet'] else '{}' end,
      case when r.status in ('on_rental','returned')
           then array['Carte grise','Attestation d''assurance','Vignette'] else '{}' end,
      case when r.delivery then 'Livraison au terminal 1' end,
      case when r.status in ('on_rental','returned') then v_start - interval '15 minutes' end,
      case when r.status in ('on_rental','returned') then c_staff end,
      case when r.status = 'cancelled' then v_start - interval '2 days' end,
      case when r.status = 'cancelled' then 'Client a annulé son voyage' end,
      case when r.client % 2 = 0 then c_staff else c_admin end)
    returning id into v_res;

    -- Payments (advance_paid is kept in sync by trigger)
    if r.status in ('returned','on_rental') or (r.status = 'reserved' and r.client % 3 <> 0) then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, paid_at, created_by)
      values (c_agency, v_res, v_advance,
              (array['cash','card','transfer','cash'])[1 + r.client % 4], 'advance',
              least(v_start, now()) - interval '1 day', c_staff);
    end if;
    if r.status in ('returned','on_rental') then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, paid_at, note, created_by)
      values (c_agency, v_res, v_deposit, 'cheque', 'deposit', v_start, 'Caution par chèque', c_staff);
    end if;
    if r.status = 'returned' then
      insert into public.reservation_payments (agency_id, reservation_id, amount, method, kind, paid_at, created_by)
      values (c_agency, v_res, v_total - v_advance, 'cash', 'balance', v_end, c_staff),
             (c_agency, v_res, v_deposit, 'cheque', 'deposit_refund', v_end, c_staff);
      v_km[r.veh] := v_km_in;
    end if;
  end loop;

  -- current km = last km in (cars on rental keep their km_out until return)
  for i in 1..12 loop
    update public.vehicles
       set current_km      = v_km[i],
           oil_last_km     = v_km[i] - case i when 2 then 9200 when 8 then 10300 else 3000 + i * 250 end,
           oil_last_date   = v_today - (20 + i * 9),
           oil_next_km     = v_km[i] - case i when 2 then 9200 when 8 then 10300 else 3000 + i * 250 end + 10000
     where id = v_vehicle[i];
    -- Vidange history: what was changed last time
    insert into public.oil_changes (agency_id, vehicle_id, date, km, next_km, items, created_by)
    values (c_agency, v_vehicle[i], v_today - (20 + i * 9),
            v_km[i] - case i when 2 then 9200 when 8 then 10300 else 3000 + i * 250 end,
            v_km[i] - case i when 2 then 9200 when 8 then 10300 else 3000 + i * 250 end + 10000,
            case when i % 3 = 0 then array['huile','filtre_huile','filtre_air'] else array['huile','filtre_huile'] end,
            c_staff);
  end loop;
  -- => car 2: vidange in ~800 km (Bientôt), car 8: vidange overdue (À faire)

  -- Achat et crédit: cars 1-4 on credit (car 1 finished), 5-6 paid cash
  insert into public.vehicle_finance (agency_id, vehicle_id, purchase_date, purchase_price, mode, down_payment, monthly_payment, months, first_payment_on, lender)
  values
    (c_agency, v_vehicle[1], v_today - 1500, 145000, 'credit', 30000, 2900, 48, v_today - 1470, 'Wafasalaf'),
    (c_agency, v_vehicle[2], v_today - 420,  165000, 'credit', 35000, 3600, 48, v_today - 390,  'Wafasalaf'),
    (c_agency, v_vehicle[3], v_today - 200,  230000, 'credit', 50000, 4900, 48, v_today - 170,  'Eqdom'),
    (c_agency, v_vehicle[4], v_today - 700,  120000, 'credit', 20000, 2600, 48, v_today - 670,  'Salafin'),
    (c_agency, v_vehicle[5], v_today - 900,  110000, 'cash',   0, null, null, null, null),
    (c_agency, v_vehicle[6], v_today - 300,  185000, 'cash',   0, null, null, null, null);

  -- Inspection départ / retour of the latest returned rental: a scratch at
  -- departure, and a new dent found at return (photos are taken in the app).
  select rr.id into v_res from public.reservations rr
   where rr.agency_id = c_agency and rr.status = 'returned' order by rr.actual_return_at desc limit 1;
  update public.agencies set inspection_enabled = true where id = c_agency;
  if v_res is not null then
    insert into public.inspections (id, agency_id, reservation_id, kind, completed_at, created_by)
    values ('00000000-0000-4000-8000-0000000d1d01', c_agency, v_res, 'departure', now() - interval '3 days', c_staff),
           ('00000000-0000-4000-8000-0000000d1d02', c_agency, v_res, 'return', now() - interval '1 day', c_staff);
    insert into public.inspection_damages (agency_id, inspection_id, x, y, type, view, note, created_by) values
      (c_agency, '00000000-0000-4000-8000-0000000d1d01', 0.30, 0.16, 'scratch', 'front', 'Rayure pare-chocs avant gauche', c_staff),
      (c_agency, '00000000-0000-4000-8000-0000000d1d02', 0.30, 0.16, 'scratch', 'front', 'Rayure pare-chocs avant gauche', c_staff),
      (c_agency, '00000000-0000-4000-8000-0000000d1d02', 0.86, 0.55, 'dent', 'right', 'Bosse portière arrière droite', c_staff);
  end if;

  -- -------------------------------------------------------------------------
  -- 6 months of charges (current month + 5 previous), only dates up to today
  -- -------------------------------------------------------------------------
  for m in 0..5 loop
    v_month := (date_trunc('month', v_today) - make_interval(months => m))::date;

    insert into public.charges (agency_id, date, category, vehicle_id, amount, campaign_name, note, created_by)
    select c_agency, d, cat, veh, amt, camp, note, c_admin
    from (values
      (v_month,                     'loyer',     null::uuid,                 6000::numeric,  null::text, 'Loyer du local'),
      (v_month + 27,                'salaires',  null,                       14000,          null,       'Salaires du mois'),
      (v_month + 4,                 'carburant', v_vehicle[1 + m],           350 + m * 20,   null,       null),
      (v_month + 11,                'carburant', v_vehicle[7 + m % 5],       480,            null,       null),
      (v_month + 19,                'carburant', v_vehicle[2 + m],           300,            null,       null),
      (v_month + 6,                 'lavage',    v_vehicle[3 + m],           60,             null,       null),
      (v_month + 13,                'lavage',    v_vehicle[8],               80,             null,       null),
      (v_month + 21,                'lavage',    v_vehicle[11],              100,            null,       'Lavage complet'),
      (v_month + 9,                 'publicite', null,                       900 + m * 100,
         'Campagne Facebook ' || to_char(v_month, 'MM/YYYY'),               null),
      (v_month + 15,                'vidange',   v_vehicle[1 + (m * 2) % 12],450,            null,       'Vidange + filtres'),
      (v_month + 17,                'autre',     null,                       250,            null,       'Fournitures bureau')
    ) as t(d, cat, veh, amt, camp, note)
    where d <= v_today;

    if m % 2 = 1 then
      insert into public.charges (agency_id, date, category, vehicle_id, amount, note, created_by)
      values (c_agency, v_month + 8, 'reparation', v_vehicle[4 + m], 1200 + m * 150, 'Plaquettes de frein', c_admin);
    end if;
  end loop;

  insert into public.charges (agency_id, date, category, vehicle_id, amount, note, created_by)
  values (c_agency, v_today - 95, 'assurance', v_vehicle[3], 4500, 'Assurance annuelle', c_admin),
         (c_agency, v_today - 60, 'visite',    v_vehicle[6], 300,  'Visite technique',   c_admin),
         (c_agency, v_today - 3,  'reparation', v_vehicle[10], 2500, 'Embrayage (acompte garage)', c_admin);

  -- Assistant IA: the agency's rental terms, searchable by the assistant
  insert into public.ai_documents (agency_id, title, source, created_by)
  values (c_agency, 'Conditions générales de location', 'system', c_admin)
  returning id into v_doc;
  insert into public.ai_chunks (agency_id, document_id, content, metadata) values
    (c_agency, v_doc, 'Âge et permis : le conducteur doit avoir au moins 21 ans et un permis de plus de 2 ans. Pièces demandées : CIN ou passeport et permis de conduire original.', '{"index":0}'),
    (c_agency, v_doc, 'Caution : 5 000 MAD pour les voitures économiques, 10 000 MAD pour les SUV et le haut de gamme, par chèque ou empreinte de carte. Elle est rendue au retour si la voiture est rendue sans dommage. Franchise en cas d''accident : 3 000 MAD.', '{"index":1}'),
    (c_agency, v_doc, 'Carburant : la voiture est rendue avec le même niveau qu''au départ, sinon le plein est facturé 15 MAD le litre. Retard : au-delà d''une heure, une journée supplémentaire est facturée. Livraison à l''aéroport Mohammed V : 200 MAD.', '{"index":2}'),
    (c_agency, v_doc, 'Sortie du territoire interdite. Kilométrage illimité au Maroc. Les amendes et infractions pendant la location sont à la charge du client.', '{"index":3}');
end;
$seed$;
