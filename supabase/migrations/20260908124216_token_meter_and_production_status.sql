-- A symbolic production reserve, starting at zero. Money stays private.
-- Capture a consistent baseline while installing triggers; no confirmed payment can slip through.
lock table public.supports, public.episodes in share row exclusive mode;
create table private.token_meter_state (
  id boolean primary key default true check (id),
  balance_cents integer not null default 0 check (balance_cents between 0 and 200000),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table private.token_meter_events (
  event_key text primary key,
  requested_cents integer not null,
  applied_cents integer not null,
  created_at timestamptz not null default now()
);
alter table private.token_meter_state enable row level security;
alter table private.token_meter_events enable row level security;
revoke all on private.token_meter_state, private.token_meter_events from public, anon, authenticated;
insert into private.token_meter_state (id) values (true);

-- The public API contains no monetary amounts, donor details or ledger entries.
create table public.token_meter_public (
  id boolean primary key default true check (id),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  level text not null default 'low' check (level in ('low','building','ready')),
  updated_at timestamptz not null default now()
);
alter table public.token_meter_public enable row level security;
revoke all on public.token_meter_public from public, anon, authenticated;
grant select on public.token_meter_public to anon, authenticated;
create policy token_meter_public_read on public.token_meter_public for select to anon, authenticated using (true);
insert into public.token_meter_public (id) values (true);

create function private.apply_token_meter_event(p_key text, p_cents integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_before integer;
  v_after integer;
  v_percent integer;
begin
  -- Serialize concurrent donations/publications; retries share a unique key.
  select balance_cents into strict v_before from private.token_meter_state where id for update;
  if exists (select 1 from private.token_meter_events where event_key = p_key) then return; end if;
  v_after := greatest(0, least(200000, v_before::bigint + p_cents));
  insert into private.token_meter_events (event_key, requested_cents, applied_cents)
    values (p_key, p_cents, v_after - v_before);
  update private.token_meter_state set balance_cents = v_after, updated_at = now() where id;
  v_percent := floor(v_after / 2000.0);
  update public.token_meter_public set progress_percent = v_percent,
    level = case when v_percent >= 90 then 'ready' when v_percent >= 40 then 'building' else 'low' end,
    updated_at = now() where id;
end;
$$;
revoke all on function private.apply_token_meter_event(text, integer) from public, anon, authenticated;

create function private.sync_token_meter_support()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_credit integer;
begin
  if new.payment_status = 'paid' then
    -- Zero-value upgrades do not create tokens. Only the amount actually paid counts.
    perform private.apply_token_meter_event('support:' || new.id::text,
      least(200000, greatest(0, round(new.amount * 100)))::integer);
  elsif new.payment_status in ('refunded','cancelled') then
    select applied_cents into v_credit from private.token_meter_events where event_key = 'support:' || new.id::text;
    if coalesce(v_credit, 0) > 0 then
      perform private.apply_token_meter_event('reversal:' || new.id::text, -v_credit);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_token_meter_support() from public, anon, authenticated;

create function private.sync_token_meter_episode()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published_at is not null then
    -- Keyed by production + episode number, not by supporter or save attempt.
    perform private.apply_token_meter_event('episode:' || new.production_id::text || ':' || new.episode_number::text, -20000);
  end if;
  return new;
end;
$$;
revoke all on function private.sync_token_meter_episode() from public, anon, authenticated;

-- Freeze the baseline: editing historical paid supports/published episodes must not move the gauge.
insert into private.token_meter_events (event_key, requested_cents, applied_cents)
select 'support:' || id::text, 0, 0 from public.supports where payment_status = 'paid';
insert into private.token_meter_events (event_key, requested_cents, applied_cents)
select 'episode:' || production_id::text || ':' || episode_number::text, 0, 0 from public.episodes where published_at is not null;

create trigger token_meter_support after insert or update of payment_status on public.supports
for each row execute function private.sync_token_meter_support();
create trigger token_meter_episode after insert or update of published_at on public.episodes
for each row execute function private.sync_token_meter_episode();

update public.productions set status = 'finished', is_current = false, updated_at = now()
where slug = 'a-ursupadollra';
insert into public.productions (slug, title, synopsis, poster_url, status, is_current)
values ('lalinha-do-bairro', 'Lalinha do Bairro', 'Em breve. Uma nova novelinha do Surto, em produção e aguardando apoio.',
  'https://osurtoartificial.com.br/assets-min/poster-la-linha-do-bairro.webp', 'upcoming', true)
on conflict (slug) do update set title = excluded.title, status = excluded.status, is_current = true, updated_at = now();
