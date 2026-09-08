-- Recurring payments are separate contracts. No existing support is converted.
alter table public.subscriptions
  add column if not exists checkout_id text unique,
  add column if not exists checkout_url text,
  add column if not exists checkout_state text not null default 'creating',
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists last_payment_due_date date;
create unique index if not exists subscriptions_one_open_per_user
  on public.subscriptions(user_id) where status in ('pending','active','past_due');
alter table public.supports add column if not exists subscription_id uuid references public.subscriptions(id);
create index if not exists supports_subscription_id_idx on public.supports(subscription_id);
create unique index if not exists supports_subscription_payment_unique
  on public.supports(provider_payment_id) where subscription_id is not null;
alter table public.subscriptions enable row level security;
-- Contracts may be changed only by the authenticated server flow, not by the browser.
revoke insert, update, delete on public.subscriptions from anon, authenticated;

create or replace function public.sync_monthly_event(p_event jsonb, p_contract uuid, p_remote jsonb, p_payment jsonb default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.subscriptions%rowtype;
  s public.supports%rowtype;
  v_status public.payment_status;
  v_production uuid;
  v_priority integer;
  v_due date;
begin
  select * into c from public.subscriptions where id=p_contract for update;
  if not found then raise exception 'Contract not found'; end if;
  if exists(select 1 from public.asaas_webhook_events where id=p_event->>'id') then return '{"duplicate":true}'::jsonb; end if;
  if p_remote is not null then
    if c.provider_subscription_id is not null and c.provider_subscription_id<>p_remote->>'id' then raise exception 'Subscription mismatch'; end if;
    if (p_remote->>'value')::numeric<>c.amount or p_remote->>'cycle'<>'MONTHLY' or p_remote->>'billingType'<>'CREDIT_CARD' then raise exception 'Contract mismatch'; end if;
    update public.subscriptions set provider_subscription_id=p_remote->>'id',
      status=case when p_remote->>'deleted'='true' then 'cancelled'::public.subscription_status
        when status='cancelled' then status
        when p_remote->>'status'='INACTIVE' then 'past_due'::public.subscription_status else status end,
      next_due_date=case when p_remote->>'deleted'='true' then null else (p_remote->>'nextDueDate')::date end,
      cancelled_at=case when p_remote->>'deleted'='true' then coalesce(cancelled_at,now()) else cancelled_at end,
      updated_at=now() where id=c.id;
  end if;
  if p_payment is not null then
    if p_payment->>'subscription'<>p_remote->>'id' or (p_payment->>'value')::numeric<>c.amount then raise exception 'Payment mismatch'; end if;
    v_status:=case p_payment->>'status'
      when 'CONFIRMED' then 'paid' when 'RECEIVED' then 'paid'
      when 'REFUNDED' then 'refunded' when 'REFUND_REQUESTED' then 'refunded' when 'REFUND_IN_PROGRESS' then 'refunded'
      when 'CHARGEBACK_REQUESTED' then 'refunded' when 'CHARGEBACK_DISPUTE' then 'refunded' when 'AWAITING_CHARGEBACK_REVERSAL' then 'refunded'
      when 'OVERDUE' then 'expired' when 'DELETED' then 'cancelled'
      when 'DUNNING_REQUESTED' then 'expired' else 'pending' end;
    if p_payment->>'deleted'='true' then v_status:='cancelled'; end if;
    if p_event->>'event' in ('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED','PAYMENT_REPROVED_BY_RISK_ANALYSIS') and v_status='pending' then v_status:='failed'; end if;
    select * into s from public.supports where subscription_id=c.id and provider_payment_id=p_payment->>'id' for update;
    if not found then
      select id into v_production from public.productions where status in ('upcoming','airing','final_weeks') order by is_current desc,created_at desc limit 1;
      insert into public.supports(user_id,production_id,tier,billing_mode,minimum_amount,amount,payment_status,payment_provider,provider_payment_id,external_reference,subscription_id)
      values(c.user_id,v_production,c.tier,'monthly',c.amount,c.amount,'pending','asaas',p_payment->>'id','monthly-payment:'||(p_payment->>'id'),c.id) returning * into s;
    end if;
    update public.supports set payment_status=v_status,
      paid_at=case when v_status='paid' then coalesce(paid_at,(p_payment->>'confirmedDate')::timestamptz,(p_payment->>'clientPaymentDate')::timestamptz,now()) else paid_at end,
      provider_checkout_id=p_payment->>'invoiceUrl',updated_at=now() where id=s.id;
    v_due:=(p_payment->>'dueDate')::date;
    if v_status='paid' then
      v_priority:=case c.tier when 'vip' then 300 when 'highlight' then 200 else 100 end;
      insert into public.appearances(support_id,status,queue_priority)
        select s.id,'waiting_profile',v_priority where not exists(select 1 from public.appearances where support_id=s.id);
      update public.subscriptions set status=case when status='cancelled' then status when p_remote->>'status'='INACTIVE' then 'past_due'::public.subscription_status else 'active'::public.subscription_status end,
        started_at=coalesce(started_at,now()),last_payment_due_date=greatest(last_payment_due_date,v_due),updated_at=now()
        where id=c.id and (last_payment_due_date is null or v_due>=last_payment_due_date);
    elsif v_status in ('refunded','cancelled','failed','expired') then
      update public.appearances set status='cancelled',updated_at=now() where support_id=s.id and status<>'published';
      update public.subscriptions set status='past_due',last_payment_due_date=greatest(last_payment_due_date,v_due),updated_at=now()
        where id=c.id and status<>'cancelled' and v_status<>'cancelled' and (last_payment_due_date is null or v_due>=last_payment_due_date);
    end if;
  end if;
  if p_event->>'event' like 'CHECKOUT_%' then
    update public.subscriptions set checkout_id=coalesce(checkout_id,p_event->'checkout'->>'id'),
      checkout_state=p_event->'checkout'->>'status',
      checkout_url=coalesce(checkout_url,'https://asaas.com/checkoutSession/show?id='||(p_event->'checkout'->>'id')),
      status=case when p_event->>'event' in ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') and provider_subscription_id is null and status='pending' then 'expired'::public.subscription_status else status end,
      updated_at=now() where id=c.id;
  end if;
  insert into public.asaas_webhook_events(id,event_type,payment_id,support_id,payload)
    values(p_event->>'id',p_event->>'event',p_payment->>'id',s.id,p_event);
  return jsonb_build_object('ok',true,'supportId',s.id);
end $$;
revoke all on function public.sync_monthly_event(jsonb,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_monthly_event(jsonb,uuid,jsonb,jsonb) to service_role;

-- Do not ask an automatic subscriber to pay again through the one-time reminder.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.queue_due_renewal_reminders()'::regprocedure) into definition;
  if definition not like '%monthly_contract%' then
    definition:=replace(definition,'and s.billing_mode = ''one_time''::public.billing_mode',
      'and s.billing_mode = ''one_time''::public.billing_mode and not exists (select 1 from public.subscriptions monthly_contract where monthly_contract.user_id=s.user_id and monthly_contract.status in (''pending'',''active'',''past_due''))');
    execute definition;
  end if;
end $$;
