create schema if not exists private;

create or replace function private.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'::public.user_role
      and status = 'active'::public.account_status
  );
$$;

revoke all on function private.is_admin_user(uuid) from public, anon;
grant execute on function private.is_admin_user(uuid) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin_user((select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

update public.profiles
set role = 'admin'::public.user_role,
    status = 'active'::public.account_status,
    updated_at = now()
where id = (
  select id from auth.users
  where lower(email) = 'eliezermoreiraa@gmail.com'
  limit 1
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant all on public.app_settings to service_role;

insert into public.app_settings (key, value)
values ('renewal_reminders', '{"enabled": true, "days": 30}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.supporter_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  support_id uuid null references public.supports(id) on delete set null,
  event_type text not null check (event_type in ('thank_you','info_request','renewal_reminder','custom')),
  recipient_email text not null,
  subject text not null,
  message text null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  idempotency_key text not null unique,
  provider_message_id text null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supporter_email_events enable row level security;
revoke all on public.supporter_email_events from anon, authenticated;
grant all on public.supporter_email_events to service_role;

create index if not exists supporter_email_events_queue_idx
  on public.supporter_email_events (status, queued_at)
  where status in ('queued','failed');
create index if not exists supporter_email_events_user_idx
  on public.supporter_email_events (user_id, created_at desc);
create index if not exists supports_paid_renewal_idx
  on public.supports (user_id, paid_at desc)
  where payment_status = 'paid'::public.payment_status
    and billing_mode = 'one_time'::public.billing_mode;

create or replace function private.queue_support_thank_you()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if new.user_id is null or new.payment_status <> 'paid'::public.payment_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.payment_status = 'paid'::public.payment_status then
    return new;
  end if;

  select coalesce(nullif(pp.notification_email, ''), u.email)
    into v_email
  from auth.users u
  left join public.publicity_profiles pp on pp.user_id = u.id
  where u.id = new.user_id;

  if v_email is null then return new; end if;

  insert into public.supporter_email_events (
    user_id, support_id, event_type, recipient_email, subject, idempotency_key, metadata
  ) values (
    new.user_id,
    new.id,
    'thank_you',
    v_email,
    'Seu apoio chegou ao Clube do Surto 💙',
    'thank_you:' || new.id::text,
    jsonb_build_object('amount', new.amount, 'tier', new.tier::text)
  ) on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function private.queue_support_thank_you() from public, anon, authenticated;

drop trigger if exists supports_queue_thank_you on public.supports;
create trigger supports_queue_thank_you
after insert or update of payment_status on public.supports
for each row execute function private.queue_support_thank_you();

create or replace function public.queue_due_renewal_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := 30;
  v_enabled boolean := true;
  v_count integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select coalesce((value->>'enabled')::boolean, true),
         greatest(coalesce((value->>'days')::integer, 30), 1)
    into v_enabled, v_days
  from public.app_settings
  where key = 'renewal_reminders';

  if not coalesce(v_enabled, true) then return 0; end if;

  insert into public.supporter_email_events (
    user_id, support_id, event_type, recipient_email, subject, idempotency_key, metadata
  )
  select
    s.user_id,
    s.id,
    'renewal_reminder',
    coalesce(nullif(pp.notification_email, ''), u.email),
    'Há 30 dias você ajudou o Surto a continuar',
    'renewal:' || s.id::text || ':' || v_days::text,
    jsonb_build_object('amount', s.amount, 'tier', s.tier::text, 'days', v_days)
  from public.supports s
  join auth.users u on u.id = s.user_id
  left join public.publicity_profiles pp on pp.user_id = s.user_id
  where s.user_id is not null
    and s.payment_status = 'paid'::public.payment_status
    and s.billing_mode = 'one_time'::public.billing_mode
    and s.paid_at is not null
    and s.paid_at <= now() - make_interval(days => v_days)
    and coalesce(nullif(pp.notification_email, ''), u.email) is not null
    and not exists (
      select 1 from public.supports newer
      where newer.user_id = s.user_id
        and newer.payment_status = 'paid'::public.payment_status
        and coalesce(newer.paid_at, newer.created_at) > coalesce(s.paid_at, s.created_at)
    )
  on conflict (idempotency_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.queue_due_renewal_reminders() from public, anon, authenticated;
grant execute on function public.queue_due_renewal_reminders() to service_role;

create or replace function public.get_runtime_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'forbidden';
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1;
  return v_secret;
end;
$$;

revoke all on function public.get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.get_runtime_secret(text) to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
