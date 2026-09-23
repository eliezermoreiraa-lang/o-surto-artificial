-- Dashboard SQL deployment, 2026-09-23. No existing payment/auth schema changes.
begin;
create schema if not exists surto_contact;
revoke all on schema surto_contact from public;
grant usage on schema surto_contact to anon, authenticated;

create table if not exists public.contract_requests (
  id uuid primary key,
  payload jsonb not null,
  email text not null,
  email_event_id uuid not null references public.supporter_email_events(id),
  created_at timestamptz not null default now()
);
alter table public.contract_requests enable row level security;
revoke all on public.contract_requests from public, anon, authenticated;
grant all on public.contract_requests to service_role;
create index if not exists contract_requests_created_idx on public.contract_requests(created_at);
create index if not exists contract_requests_email_created_idx on public.contract_requests(email, created_at);

-- The privileged implementation is outside the exposed API schema. This is an
-- intentionally anonymous, insert-only contact form, NOT an authenticated-user
-- endpoint. Callers can never choose recipient, email type, owner or read rows.
create or replace function surto_contact.submit(p_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_existing jsonb;
  v_email text;
  v_owner uuid;
  v_event uuid;
  v_field text;
begin
  if p_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 14000 then
    raise exception using errcode='PT400', message='Dados do pedido inválidos.';
  end if;
  foreach v_field in array array['name','email','company','idea','deadline','budget','website'] loop
    if p_payload ? v_field and jsonb_typeof(p_payload->v_field) <> 'string' then
      raise exception using errcode='PT400', message='Campos inválidos.';
    end if;
  end loop;
  if coalesce(p_payload->>'website','') <> '' then
    raise exception using errcode='PT400', message='Não foi possível enviar. Entre em contato por e-mail.';
  end if;
  v_email := lower(btrim(coalesce(p_payload->>'email','')));
  v_payload := jsonb_build_object(
    'name',btrim(coalesce(p_payload->>'name','')),
    'email',v_email,
    'company',btrim(coalesce(p_payload->>'company','')),
    'idea',btrim(coalesce(p_payload->>'idea','')),
    'deadline',btrim(coalesce(p_payload->>'deadline','')),
    'budget',btrim(coalesce(p_payload->>'budget',''))
  );
  if length(v_payload->>'name') not between 2 and 120
    or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(v_payload->>'idea') not between 10 and 5000
    or length(v_payload->>'company') > 200
    or length(v_payload->>'deadline') > 120
    or length(v_payload->>'budget') > 120 then
    raise exception using errcode='PT400', message='Confira seu nome, e-mail e a descrição da ideia (mínimo de 10 caracteres).';
  end if;
  -- Serialize low-volume form submissions: limits and deduplication stay atomic.
  if not pg_try_advisory_xact_lock(9232026, 1) then
    raise exception using errcode='PT429', message='Aguarde um instante e tente novamente.';
  end if;
  select payload into v_existing from public.contract_requests where id=p_id;
  if found then
    if v_existing <> v_payload then
      raise exception using errcode='PT409', message='O identificador já foi utilizado. Atualize a página.';
    end if;
    return jsonb_build_object('ok',true,'id',p_id);
  end if;
  if (select count(*) from public.contract_requests where created_at > now()-interval '1 hour') >= 30
     or (select count(*) from public.contract_requests where email=v_email and created_at > now()-interval '1 hour') >= 3 then
    raise exception using errcode='PT429', message='Limite de envios atingido. Tente mais tarde ou escreva para osurtoartificial@gmail.com.';
  end if;
  select p.id into v_owner from public.profiles p join auth.users u on u.id=p.id
    where u.email='eliezermoreiraa@gmail.com';
  if v_owner is null then
    raise exception using errcode='PT503', message='Formulário temporariamente indisponível. Escreva para osurtoartificial@gmail.com.';
  end if;
  insert into public.supporter_email_events(user_id,event_type,recipient_email,subject,message,idempotency_key,metadata)
  values(v_owner,'custom','osurtoartificial@gmail.com','Novo orçamento — Contrate o Surto',
    'NOVO PEDIDO DE ORÇAMENTO' || E'\nProtocolo: ' || p_id::text ||
    E'\nNome: ' || (v_payload->>'name') || E'\nE-mail para responder: ' || v_email ||
    E'\nEmpresa/projeto: ' || coalesce(nullif(v_payload->>'company',''),'Não informado') ||
    E'\nPrazo desejado: ' || coalesce(nullif(v_payload->>'deadline',''),'Não informado') ||
    E'\nOrçamento estimado: ' || coalesce(nullif(v_payload->>'budget',''),'Não informado') ||
    E'\n\nIdeia:\n' || (v_payload->>'idea'),
    'contract-request/' || p_id::text, jsonb_build_object('contract_request_id',p_id,'source','contrate'))
  returning id into v_event;
  insert into public.contract_requests(id,payload,email,email_event_id)
    values(p_id,v_payload,v_email,v_event);
  return jsonb_build_object('ok',true,'id',p_id);
end;
$$;
revoke all on function surto_contact.submit(uuid,jsonb) from public;
grant execute on function surto_contact.submit(uuid,jsonb) to anon, authenticated;

create or replace function public.submit_contract_request(p_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select surto_contact.submit(p_id,p_payload);
$$;
revoke all on function public.submit_contract_request(uuid,jsonb) from public;
grant execute on function public.submit_contract_request(uuid,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
