-- Clévora — storage buckets and policies.
-- Every object path starts with the agency id: {agency_id}/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('agency-logos', 'agency-logos', true,  1048576,
     array['image/png','image/jpeg','image/svg+xml','image/webp']),
  ('agency-docs',  'agency-docs',  false, 10485760, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- agency-logos: public read through the public URL (no listing policy needed);
-- only admins of the agency in the first folder can write.
-- ---------------------------------------------------------------------------
create policy "agency-logos: admins read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  );
create policy "agency-logos: admins upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  );
create policy "agency-logos: admins update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  )
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  );
create policy "agency-logos: admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  );

-- ---------------------------------------------------------------------------
-- agency-docs (private): members read/write under {agency_id}/…,
-- except {agency_id}/charges/… (receipts = money) which is admin-only.
-- Delete is admin-only.
-- ---------------------------------------------------------------------------
create policy "agency-docs: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.current_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  );
create policy "agency-docs: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.current_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  );
create policy "agency-docs: update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.current_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  )
  with check (
    bucket_id = 'agency-docs'
    and (
      (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
      or (
        (storage.foldername(name))[1] in (select a::text from public.current_agency_ids() a)
        and coalesce((storage.foldername(name))[2], '') <> 'charges'
      )
    )
  );
create policy "agency-docs: admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-docs'
    and (storage.foldername(name))[1] in (select a::text from public.current_agency_ids(array['admin']) a)
  );
