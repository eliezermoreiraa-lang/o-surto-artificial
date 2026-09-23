-- Run in SQL Editor. Every test row/email is rolled back, never sent.
begin;
set local role anon;
do $$
declare
  k uuid := gen_random_uuid();
  p jsonb := '{"name":"QA rollback","email":"contract-qa@example.invalid","idea":"Teste transacional, não enviar."}'::jsonb;
  a jsonb;
  b jsonb;
begin
  a := public.submit_contract_request(k,p);
  b := public.submit_contract_request(k,p);
  assert a=b and (a->>'ok')::boolean, 'idempotency';
  begin
    perform public.submit_contract_request(k,p || '{"name":"Different"}'::jsonb);
    raise exception 'conflict accepted';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.submit_contract_request(gen_random_uuid(),p || '{"email":"invalid@exampleXcom"}'::jsonb);
    raise exception 'bad email accepted';
  exception when sqlstate 'PT400' then null; end;
  begin
    perform public.submit_contract_request(gen_random_uuid(),p || '{"idea":"short"}'::jsonb);
    raise exception 'short idea accepted';
  exception when sqlstate 'PT400' then null; end;
  begin
    perform public.submit_contract_request(gen_random_uuid(),p || '{"website":"bot"}'::jsonb);
    raise exception 'honeypot accepted';
  exception when sqlstate 'PT400' then null; end;
  begin
    perform public.submit_contract_request(gen_random_uuid(),p || '{"name":null}'::jsonb);
    raise exception 'null accepted';
  exception when sqlstate 'PT400' then null; end;
  begin
    perform 1 from public.contract_requests;
    raise exception 'private requests exposed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.supporter_email_events;
    raise exception 'email queue exposed';
  exception when insufficient_privilege then null; end;
  perform public.submit_contract_request(gen_random_uuid(),p);
  perform public.submit_contract_request(gen_random_uuid(),p);
  begin
    perform public.submit_contract_request(gen_random_uuid(),p);
    raise exception 'rate limit bypassed';
  exception when sqlstate 'PT429' then null; end;
end $$;
reset role;
select count(*)=3 as three_requests_only,
  (select count(*) from public.supporter_email_events where metadata->>'source'='contrate'
   and message like '%contract-qa@example.invalid%')=3 as three_emails_only
from public.contract_requests where email='contract-qa@example.invalid';
rollback;
