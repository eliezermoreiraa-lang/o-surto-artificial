create or replace function private.sync_supporter_wall_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_support record;
  v_avatar_url text;
  v_social_url text;
  v_handle text;
  v_published_appearances integer := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select
    pp.display_name,
    pp.social_handle,
    pp.social_url,
    pp.social_network,
    pp.official_avatar_path,
    pp.public_consent,
    pp.avatar_status
  into v_profile
  from public.publicity_profiles pp
  where pp.user_id = p_user_id;

  if not found then
    update public.wall_entries
    set is_visible = false
    where user_id = p_user_id;
    return;
  end if;

  update public.wall_entries
  set is_visible = false
  where user_id = p_user_id;

  if coalesce(v_profile.public_consent, false) is not true
     or v_profile.avatar_status <> 'ready'
     or nullif(btrim(v_profile.official_avatar_path), '') is null
  then
    return;
  end if;

  v_social_url := nullif(btrim(v_profile.social_url), '');
  v_handle := regexp_replace(btrim(coalesce(v_profile.social_handle, '')), '^@', '');
  if v_social_url is null and v_handle ~ '^[a-zA-Z0-9_.-]+$' then
    v_social_url := case lower(v_profile.social_network)
      when 'instagram' then 'https://www.instagram.com/' || v_handle || '/'
      when 'tiktok' then 'https://www.tiktok.com/@' || v_handle
      when 'youtube' then 'https://www.youtube.com/@' || v_handle
      when 'x' then 'https://x.com/' || v_handle
      when 'facebook' then 'https://www.facebook.com/' || v_handle
      else null end;
  end if;
  if v_social_url is not null and v_social_url !~* '^https://' then
    v_social_url := null;
  end if;

  if v_profile.official_avatar_path ~* '^https?://' then
    v_avatar_url := v_profile.official_avatar_path;
  else
    v_avatar_url := 'https://ndfchglutpnbckpcrppy.supabase.co/storage/v1/object/public/supporter-avatars/'
      || regexp_replace(v_profile.official_avatar_path, '^/+', '');
  end if;

  select count(*)::integer
  into v_published_appearances
  from public.appearances a
  join public.supports s on s.id = a.support_id
  where s.user_id = p_user_id
    and s.payment_status = 'paid'
      and s.tier <> 'free'
    and a.status = 'published';

  for v_support in
    select s.id, s.tier, s.paid_at, s.created_at
    from public.supports s
    where s.user_id = p_user_id
      and s.payment_status = 'paid'
      and s.tier <> 'free'
  loop
    insert into public.wall_entries (
      support_id,
      user_id,
      tier,
      display_name,
      social_handle,
      social_url,
      avatar_url,
      wall_month,
      is_visible,
      published_at,
      published_appearances
    ) values (
      v_support.id,
      p_user_id,
      v_support.tier,
      coalesce(nullif(btrim(v_profile.display_name), ''), nullif(btrim(v_profile.social_handle), ''), 'Apoiador'),
      nullif(btrim(v_profile.social_handle), ''),
      v_social_url,
      v_avatar_url,
      date_trunc(
        'month',
        coalesce(v_support.paid_at, v_support.created_at) at time zone 'America/Sao_Paulo'
      )::date,
      true,
      now(),
      v_published_appearances
    )
    on conflict (support_id) do update set
      user_id = excluded.user_id,
      tier = excluded.tier,
      display_name = excluded.display_name,
      social_handle = excluded.social_handle,
      social_url = excluded.social_url,
      avatar_url = excluded.avatar_url,
      wall_month = excluded.wall_month,
      is_visible = true,
      published_at = coalesce(public.wall_entries.published_at, excluded.published_at),
      published_appearances = excluded.published_appearances;
  end loop;
end;
$$;

revoke all on function private.sync_supporter_wall_for_user(uuid) from public, anon, authenticated;
grant execute on function private.sync_supporter_wall_for_user(uuid) to service_role;


-- Production fields are written only through validated server endpoints.
revoke insert, update on public.publicity_profiles from anon, authenticated;
grant insert (user_id, source_photo_path, face_photo_path, body_photo_path, updated_at),
      update (user_id, source_photo_path, face_photo_path, body_photo_path, updated_at)
on public.publicity_profiles to authenticated;
-- A supporter may never promote their own account to administrator.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;
