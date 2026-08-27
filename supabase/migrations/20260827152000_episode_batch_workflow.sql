alter table public.episodes
  add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'episode-covers',
  'episode-covers',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "episode_covers_admin_insert" on storage.objects;
create policy "episode_covers_admin_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'episode-covers' and public.is_admin());

drop policy if exists "episode_covers_admin_update" on storage.objects;
create policy "episode_covers_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'episode-covers' and public.is_admin())
with check (bucket_id = 'episode-covers' and public.is_admin());

drop policy if exists "episode_covers_admin_delete" on storage.objects;
create policy "episode_covers_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'episode-covers' and public.is_admin());

create index if not exists appearances_episode_status_idx
  on public.appearances (episode_id, status);

comment on column public.episodes.cover_image_url is
  'Public cover or banner displayed for supporters assigned to the episode.';
