alter table public.vip_briefings
  add column if not exists reference_image_paths text[] not null default '{}';

alter table public.vip_briefings
  drop constraint if exists vip_briefings_reference_images_limit;

alter table public.vip_briefings
  add constraint vip_briefings_reference_images_limit
  check (cardinality(reference_image_paths) between 0 and 3);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vip-briefing-images',
  'vip-briefing-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vip_briefing_images_select_own on storage.objects;
create policy vip_briefing_images_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vip-briefing-images'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.supports s
        where s.user_id = (select auth.uid())
          and s.payment_status = 'paid'
          and s.tier = 'vip'
      )
    )
  )
);

drop policy if exists vip_briefing_images_insert_own on storage.objects;
create policy vip_briefing_images_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vip-briefing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and exists (
    select 1 from public.supports s
    where s.user_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[2]
      and s.payment_status = 'paid'
      and s.tier = 'vip'
  )
  and exists (
    select 1 from public.publicity_profiles p
    where p.user_id = (select auth.uid())
      and nullif(btrim(p.display_name), '') is not null
      and nullif(btrim(p.social_network), '') is not null
      and nullif(btrim(p.social_handle), '') is not null
      and nullif(btrim(p.notification_email), '') is not null
      and p.public_consent = true
  )
);

drop policy if exists vip_briefing_images_delete_own on storage.objects;
create policy vip_briefing_images_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vip-briefing-images'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.supports s
        where s.user_id = (select auth.uid())
          and s.payment_status = 'paid'
          and s.tier = 'vip'
      )
    )
  )
);

comment on column public.vip_briefings.reference_image_paths is
  'Up to three private Storage paths sent by the VIP supporter as visual references for the scene.';
