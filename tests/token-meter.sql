-- Run inside a transaction and ROLLBACK. Only temporary sources are used.
create temporary table meter_test_support (id uuid primary key, payment_status public.payment_status, amount numeric);
create trigger meter_test_support after insert or update of payment_status on meter_test_support
for each row execute function private.sync_token_meter_support();
create temporary table meter_test_episode (production_id uuid, episode_number integer, published_at timestamptz);
create trigger meter_test_episode after insert or update of published_at on meter_test_episode
for each row execute function private.sync_token_meter_episode();
do $$
declare
  v_support uuid := gen_random_uuid();
  v_large uuid := gen_random_uuid();
  v_production uuid := gen_random_uuid();
  v_balance integer;
begin
  assert (select balance_cents = 0 from private.token_meter_state where id), 'must start at zero';
  insert into meter_test_support values (v_support, 'pending', 500);
  assert (select progress_percent = 0 from public.token_meter_public where id), 'pending must not count';
  update meter_test_support set payment_status = 'paid' where id = v_support;
  assert (select progress_percent = 25 and level = 'low' from public.token_meter_public where id), 'paid donation must count';
  update meter_test_support set payment_status = 'paid' where id = v_support;
  assert (select progress_percent = 25 from public.token_meter_public where id), 'duplicate payment must not count';
  insert into meter_test_episode values (v_production, 1, null);
  assert (select progress_percent = 25 from public.token_meter_public where id), 'draft must not consume';
  update meter_test_episode set published_at = now() where episode_number = 1;
  assert (select progress_percent = 15 from public.token_meter_public where id), 'publication must consume';
  update meter_test_episode set published_at = null where episode_number = 1;
  update meter_test_episode set published_at = now() where episode_number = 1;
  assert (select progress_percent = 15 from public.token_meter_public where id), 'republishing must not consume twice';
  insert into meter_test_episode values (v_production, 2, now()), (v_production, 3, now());
  assert (select progress_percent = 0 from public.token_meter_public where id), 'cannot be negative';
  insert into meter_test_support values (gen_random_uuid(), 'paid', 1000);
  assert (select progress_percent = 50 and level = 'building' from public.token_meter_public where id), 'yellow threshold';
  insert into meter_test_support values (v_large, 'paid', 5000);
  assert (select progress_percent = 100 and level = 'ready' from public.token_meter_public where id), 'cap at full';
  insert into meter_test_episode values (v_production, 4, now());
  assert (select progress_percent = 90 and level = 'ready' from public.token_meter_public where id), 'new episode always lowers full gauge';
  update meter_test_support set payment_status = 'refunded' where id = v_large;
  assert (select progress_percent = 40 from public.token_meter_public where id), 'refund reverses only effective credit';
  update meter_test_support set payment_status = 'refunded' where id = v_large;
  assert (select progress_percent = 40 from public.token_meter_public where id), 'refund is idempotent';
  insert into meter_test_support values (gen_random_uuid(), 'paid', 0);
  assert (select progress_percent = 40 from public.token_meter_public where id), 'free upgrade cannot increase meter';
  assert not has_table_privilege('anon', 'private.token_meter_state', 'select'), 'balance must be private';
  assert not has_table_privilege('authenticated', 'private.token_meter_events', 'select'), 'ledger must be private';
  assert not has_table_privilege('anon', 'public.token_meter_public', 'update'), 'visitors cannot modify progress';
  assert not has_function_privilege('authenticated', 'private.apply_token_meter_event(text,integer)', 'execute'), 'users cannot create fake events';
  assert has_table_privilege('anon', 'public.token_meter_public', 'select'), 'progress must be readable';
end;
$$;
