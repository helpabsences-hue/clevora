-- Clévora — default plans. Needed on every environment (create_agency uses 'pro').
-- Prices are placeholders in MAD; change them in the table, no code change needed.
-- Yearly price = 10 months (2 months free).

insert into public.plans (code, name, max_vehicles, max_users, ai_enabled, price_mad_month, price_mad_year, active)
values
  ('essentiel', 'Essentiel', 15,   3,    false, 299, 2990, true),
  ('pro',       'Pro',       50,   10,   true,  599, 5990, true),
  ('illimite',  'Illimité',  null, null, true,  999, 9990, true)
on conflict (code) do nothing;
