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
