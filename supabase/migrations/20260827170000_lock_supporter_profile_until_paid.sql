drop policy if exists publicity_insert_own on public.publicity_profiles;
create policy publicity_insert_own
on public.publicity_profiles
for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.supports s
      where s.user_id = (select auth.uid())
        and s.payment_status = 'paid'
    )
  )
);

drop policy if exists publicity_update_own on public.publicity_profiles;
create policy publicity_update_own
on public.publicity_profiles
for update
to authenticated
using (
  public.is_admin()
  or (
    user_id = (select auth.uid())
    and submission_completed_at is null
    and exists (
      select 1
      from public.supports s
      where s.user_id = (select auth.uid())
        and s.payment_status = 'paid'
    )
  )
)
with check (
  public.is_admin()
  or (
    user_id = (select auth.uid())
    and submission_completed_at is null
    and exists (
      select 1
      from public.supports s
      where s.user_id = (select auth.uid())
        and s.payment_status = 'paid'
    )
  )
);

drop policy if exists supporter_photos_insert_own on storage.objects;
create policy supporter_photos_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'supporter-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.supports s
    where s.user_id = (select auth.uid())
      and s.payment_status = 'paid'
  )
);

drop policy if exists supporter_photos_update_own on storage.objects;
create policy supporter_photos_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'supporter-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.supports s
        where s.user_id = (select auth.uid())
          and s.payment_status = 'paid'
      )
    )
  )
)
with check (
  bucket_id = 'supporter-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.supports s
        where s.user_id = (select auth.uid())
          and s.payment_status = 'paid'
      )
    )
  )
);

drop policy if exists supporter_photos_delete_own on storage.objects;
create policy supporter_photos_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'supporter-photos'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.supports s
        where s.user_id = (select auth.uid())
          and s.payment_status = 'paid'
      )
    )
  )
);
