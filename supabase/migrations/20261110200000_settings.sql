-- Settings: an admin can delete the agency (and all its data) by typing its name.
-- Storage files are removed by the server action (service role) before this runs.

create or replace function public.delete_agency(p_agency uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.has_role(p_agency, array['admin']) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  select name into v_name from public.agencies where id = p_agency;
  if v_name is null or lower(btrim(v_name)) <> lower(btrim(coalesce(p_confirm_name, ''))) then
    raise exception 'Le nom ne correspond pas' using errcode = '22023', hint = 'confirm_name';
  end if;
  -- Business rows reference the agency with on delete cascade.
  delete from public.agencies where id = p_agency;
end;
$$;

revoke execute on function public.delete_agency(uuid, text) from public, anon;
grant execute on function public.delete_agency(uuid, text) to authenticated, service_role;
