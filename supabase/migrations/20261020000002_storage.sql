-- Private bucket for conversation screenshots.
-- Object paths are "<organization_id>/<yyyy-mm-dd>/<uuid>.<ext>"; the first folder is the tenant.
-- Files are short-lived: the purge job removes them after the organization's retention window.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy screenshots_member_read on storage.objects for select
  using (
    bucket_id = 'screenshots'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy screenshots_operator_insert on storage.objects for insert
  with check (
    bucket_id = 'screenshots'
    and public.has_org_role(((storage.foldername(name))[1])::uuid,
                            array['owner', 'admin', 'operator']::public.member_role[])
  );

create policy screenshots_operator_delete on storage.objects for delete
  using (
    bucket_id = 'screenshots'
    and public.has_org_role(((storage.foldername(name))[1])::uuid,
                            array['owner', 'admin', 'operator']::public.member_role[])
  );
