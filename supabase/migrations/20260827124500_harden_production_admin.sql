create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin_user((select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

drop policy if exists app_settings_no_client_access on public.app_settings;
create policy app_settings_no_client_access
on public.app_settings for all to authenticated
using (false) with check (false);

drop policy if exists supporter_email_events_no_client_access on public.supporter_email_events;
create policy supporter_email_events_no_client_access
on public.supporter_email_events for all to authenticated
using (false) with check (false);

create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);
create index if not exists supporter_email_events_support_idx on public.supporter_email_events(support_id);
create index if not exists appearances_episode_id_idx on public.appearances(episode_id);
create index if not exists supports_production_id_idx on public.supports(production_id);
create index if not exists supports_upgrade_from_support_id_idx on public.supports(upgrade_from_support_id);
