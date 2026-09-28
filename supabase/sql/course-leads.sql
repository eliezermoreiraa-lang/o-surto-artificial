-- Additive deployment. No changes to payments, users or existing lead data.
begin;
create table if not exists public.course_leads (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','whatsapp')),
  contact text not null check (contact = lower(btrim(contact)) and length(contact) <= 254),
  consent boolean not null check (consent = true),
  consent_version text not null default 'courses-20260928-v1',
  website text not null default '' check (website = ''),
  status text not null default 'new' check (status in ('new','contacted','coupon_sent','archived')),
  created_at timestamptz not null default now(),
  constraint course_leads_contact_format check (
    (channel = 'email' and contact ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or
    (channel = 'whatsapp' and contact ~ '^\+[1-9][0-9]{7,14}$')
  ),
  constraint course_leads_channel_contact_key unique(channel,contact)
);
alter table public.course_leads enable row level security;
revoke all on public.course_leads from public, anon, authenticated;
grant insert(channel,contact,consent,website) on public.course_leads to anon, authenticated;
grant select on public.course_leads to authenticated;
grant update(status) on public.course_leads to authenticated;
grant all on public.course_leads to service_role;
create policy course_leads_signup on public.course_leads for insert to anon, authenticated
  with check (consent = true and website = '' and status = 'new' and consent_version = 'courses-20260928-v1');
create policy course_leads_admin_read on public.course_leads for select to authenticated
  using ((select public.is_admin()));
create policy course_leads_admin_status on public.course_leads for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create index course_leads_created_idx on public.course_leads(created_at desc, id);
notify pgrst, 'reload schema';
commit;
