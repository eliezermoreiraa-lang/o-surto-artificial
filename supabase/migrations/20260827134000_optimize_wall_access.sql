create index if not exists wall_entries_user_id_idx
on public.wall_entries(user_id);

drop policy if exists wall_admin_all on public.wall_entries;
drop policy if exists wall_public_read_visible on public.wall_entries;

create policy wall_public_read_visible_anon
on public.wall_entries
for select
to anon
using (is_visible = true);

create policy wall_authenticated_read
on public.wall_entries
for select
to authenticated
using (is_visible = true or public.is_admin());

create policy wall_admin_insert
on public.wall_entries
for insert
to authenticated
with check (public.is_admin());

create policy wall_admin_update
on public.wall_entries
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy wall_admin_delete
on public.wall_entries
for delete
to authenticated
using (public.is_admin());

