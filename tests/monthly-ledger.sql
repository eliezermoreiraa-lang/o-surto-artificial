-- Integration test: all writes roll back, including outbox, wall and token meter triggers.
begin;
select set_config('qa.monthly_owner',(select id::text from auth.users where email='eliezermoreiraa@gmail.com'),true);
set local role service_role;
do $$
declare
  v_user uuid;
  c uuid;
  remote jsonb := '{"id":"sub_monthly_qa","value":50,"cycle":"MONTHLY","billingType":"CREDIT_CARD","status":"ACTIVE","nextDueDate":"2026-10-08"}';
  p jsonb := '{"id":"pay_monthly_qa_1","subscription":"sub_monthly_qa","value":50,"status":"CONFIRMED","dueDate":"2026-09-08","confirmedDate":"2026-09-08"}';
  n integer;
begin
  v_user:=current_setting('qa.monthly_owner')::uuid;
  if v_user is null then raise exception 'Test owner missing'; end if;
  insert into public.subscriptions(user_id,tier,amount,status,consent_at,consent_version)
    values(v_user,'supporter',50,'pending',now(),'monthly-card-2026-09-08') returning id into c;
  perform public.sync_monthly_event('{"id":"qa_monthly_1","event":"PAYMENT_CONFIRMED"}',c,remote,p);
  perform public.sync_monthly_event('{"id":"qa_monthly_1","event":"PAYMENT_CONFIRMED"}',c,remote,p);
  perform public.sync_monthly_event('{"id":"qa_monthly_2","event":"PAYMENT_RECEIVED"}',c,remote,p);
  select count(*) into n from public.supports where subscription_id=c;
  if n<>1 then raise exception 'Duplicate support'; end if;
  select count(*) into n from public.appearances a join public.supports s on s.id=a.support_id where s.subscription_id=c;
  if n<>1 then raise exception 'Duplicate or missing appearance'; end if;
  p:=p||'{"id":"pay_monthly_qa_2","dueDate":"2026-10-08","confirmedDate":"2026-10-08"}';
  perform public.sync_monthly_event('{"id":"qa_monthly_3","event":"PAYMENT_RECEIVED"}',c,remote,p);
  select count(*) into n from public.supports where subscription_id=c and payment_status='paid';
  if n<>2 then raise exception 'Renewal missing'; end if;
  select count(*) into n from public.appearances a join public.supports s on s.id=a.support_id where s.subscription_id=c;
  if n<>2 then raise exception 'Renewal appearance missing'; end if;
  p:=p||'{"id":"pay_monthly_qa_3","dueDate":"2026-11-08","status":"OVERDUE"}';
  perform public.sync_monthly_event('{"id":"qa_monthly_4","event":"PAYMENT_OVERDUE"}',c,remote,p);
  if (select status from public.subscriptions where id=c)<>'past_due' then raise exception 'Past due missing'; end if;
  select count(*) into n from public.appearances a join public.supports s on s.id=a.support_id where s.subscription_id=c;
  if n<>2 then raise exception 'Unpaid benefit granted'; end if;
  p:=p||'{"id":"pay_monthly_qa_1","dueDate":"2026-09-08","status":"CONFIRMED"}';
  perform public.sync_monthly_event('{"id":"qa_monthly_5","event":"PAYMENT_RECEIVED"}',c,remote,p);
  if (select status from public.subscriptions where id=c)<>'past_due' then raise exception 'Old payment overwrote current failure'; end if;
  remote:=remote||'{"deleted":true}';
  perform public.sync_monthly_event('{"id":"qa_monthly_6","event":"SUBSCRIPTION_DELETED"}',c,remote,null);
  if (select status from public.subscriptions where id=c)<>'cancelled' then raise exception 'Cancellation missing'; end if;
  select count(*) into n from public.supports where subscription_id=c and payment_status='paid';
  if n<>2 then raise exception 'Cancellation modified prior payments'; end if;
  if has_function_privilege('authenticated','public.sync_monthly_event(jsonb,uuid,jsonb,jsonb)','execute') then raise exception 'RPC exposed'; end if;
  if has_table_privilege('authenticated','public.subscriptions','update') then raise exception 'Client may update contract'; end if;
end $$;
rollback;
select 'PASS: renewal, duplicate delivery, failed payment, event ordering, cancellation, RLS; all test records rolled back' as result;
