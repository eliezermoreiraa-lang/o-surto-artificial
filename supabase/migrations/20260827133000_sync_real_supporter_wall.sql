alter table public.wall_entries
  add column if not exists published_appearances integer not null default 0;

alter table public.wall_entries
  drop constraint if exists wall_entries_published_appearances_nonnegative;

alter table public.wall_entries
  add constraint wall_entries_published_appearances_nonnegative
  check (published_appearances >= 0);

comment on column public.wall_entries.published_appearances is
  'Total de aparicoes publicadas do apoiador, usado para ordenar o hall publico.';

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
  v_published_appearances integer := 0;
begin
  if p_user_id is null then
    return;
  end if;

  select
    pp.display_name,
    pp.social_handle,
    pp.social_url,
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
     or nullif(btrim(v_profile.social_url), '') is null
     or v_profile.social_url !~* '^https?://'
  then
    return;
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
    and a.status = 'published';

  for v_support in
    select s.id, s.tier, s.paid_at, s.created_at
    from public.supports s
    where s.user_id = p_user_id
      and s.payment_status = 'paid'
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
      btrim(v_profile.social_url),
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

create or replace function private.sync_supporter_wall_from_support()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_supporter_wall_for_user(old.user_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform private.sync_supporter_wall_for_user(old.user_id);
  end if;

  perform private.sync_supporter_wall_for_user(new.user_id);
  return new;
end;
$$;

create or replace function private.sync_supporter_wall_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_supporter_wall_for_user(old.user_id);
    return old;
  end if;

  perform private.sync_supporter_wall_for_user(new.user_id);
  return new;
end;
$$;

create or replace function private.sync_supporter_wall_from_appearance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  if tg_op <> 'INSERT' then
    select s.user_id into v_old_user_id
    from public.supports s
    where s.id = old.support_id;
    perform private.sync_supporter_wall_for_user(v_old_user_id);
  end if;

  if tg_op <> 'DELETE' then
    select s.user_id into v_new_user_id
    from public.supports s
    where s.id = new.support_id;
    if v_new_user_id is distinct from v_old_user_id then
      perform private.sync_supporter_wall_for_user(v_new_user_id);
    end if;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists sync_supporter_wall_on_support on public.supports;
create trigger sync_supporter_wall_on_support
after insert or update or delete on public.supports
for each row execute function private.sync_supporter_wall_from_support();

drop trigger if exists sync_supporter_wall_on_profile on public.publicity_profiles;
create trigger sync_supporter_wall_on_profile
after insert or update or delete on public.publicity_profiles
for each row execute function private.sync_supporter_wall_from_profile();

drop trigger if exists sync_supporter_wall_on_appearance on public.appearances;
create trigger sync_supporter_wall_on_appearance
after insert or update or delete on public.appearances
for each row execute function private.sync_supporter_wall_from_appearance();

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct s.user_id
    from public.supports s
    where s.user_id is not null
  loop
    perform private.sync_supporter_wall_for_user(v_user_id);
  end loop;
end;
$$;

alter table public.wall_entries enable row level security;
grant select on public.wall_entries to anon, authenticated;
