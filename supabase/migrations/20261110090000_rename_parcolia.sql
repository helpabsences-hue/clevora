-- Product renamed to Parcolia: update the one user-visible message that named the brand.
create or replace function public.tg_agencies_protect_billing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.plan_id, new.subscription_status, new.trial_ends_at, new.current_period_end)
       is distinct from
     (old.plan_id, old.subscription_status, old.trial_ends_at, old.current_period_end)
     and current_user in ('authenticated', 'anon')
     and not public.is_platform_admin() then
    raise exception 'Seule l''équipe Parcolia peut modifier le forfait ou l''abonnement'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
