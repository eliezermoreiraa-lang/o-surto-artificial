create table public.guest_support_checkouts (
 token_hash text primary key check (length(token_hash)=64),
 fingerprint text not null,
 ip_hash text not null,
 support_id uuid not null default gen_random_uuid(),
 state text not null default 'processing' check(state in ('processing','ready','failed')),
 result jsonb,
 created_at timestamptz not null default now()
);
create index guest_support_checkouts_ip_created on public.guest_support_checkouts(ip_hash,created_at);
create index guest_support_checkouts_created on public.guest_support_checkouts(created_at);
alter table public.guest_support_checkouts enable row level security;
revoke all on public.guest_support_checkouts from public,anon,authenticated;
grant all on public.guest_support_checkouts to service_role;

create function public.claim_guest_support_checkout(p_token_hash text,p_fingerprint text,p_ip_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.guest_support_checkouts; begin
 perform pg_advisory_xact_lock(849312);
 select * into v from public.guest_support_checkouts where token_hash=p_token_hash;
 if found then
  if v.fingerprint<>p_fingerprint then return jsonb_build_object('error','conflict'); end if;
  return jsonb_build_object('existing',true,'checkout',to_jsonb(v));
 end if;
 if (select count(*) from public.guest_support_checkouts where ip_hash=p_ip_hash and created_at>now()-interval '10 minutes')>=5
 or (select count(*) from public.guest_support_checkouts where created_at>now()-interval '1 minute')>=60 then
  return jsonb_build_object('error','rate_limit');
 end if;
 insert into public.guest_support_checkouts(token_hash,fingerprint,ip_hash) values(p_token_hash,p_fingerprint,p_ip_hash) returning * into v;
 return jsonb_build_object('existing',false,'checkout',to_jsonb(v));
end; $$;
revoke all on function public.claim_guest_support_checkout(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_guest_support_checkout(text,text,text) to service_role;
