drop policy if exists wall_public_read_visible on public.wall_entries;

create policy wall_public_read_visible
on public.wall_entries
for select
to anon, authenticated
using (is_visible = true);

