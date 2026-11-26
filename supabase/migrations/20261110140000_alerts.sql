-- Daily alert email: who receives it, and no double sending on the same day.
alter table public.agencies
  add column alert_roles text[] not null default array['admin']
    check (alert_roles <@ array['admin', 'staff'] and cardinality(alert_roles) >= 1),
  add column alerts_sent_on date;

-- alerts_sent_on is written by the server job only (service role)
create or replace function public.tg_agencies_protect_alert_marker()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.alerts_sent_on is distinct from old.alerts_sent_on and current_user in ('authenticated', 'anon') then
    raise exception 'Champ réservé au système' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_alert_marker before update on public.agencies
  for each row execute function public.tg_agencies_protect_alert_marker();
