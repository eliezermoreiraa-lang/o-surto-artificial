begin;
do $$
declare
 u uuid := current_setting('qa.user_id')::uuid;
 s uuid := gen_random_uuid();
 f uuid := gen_random_uuid();
begin
 insert into public.supports(id,user_id,tier,billing_mode,minimum_amount,amount,payment_status,payment_provider)
 values(s,u,'supporter','one_time',50,50,'pending','qa_rollback');
 insert into public.publicity_profiles(user_id,display_name,social_network,social_handle,social_url,public_consent,avatar_status)
 values(u,'Teste QA','instagram','osurtoartificial',null,true,'awaiting');
 assert not exists(select 1 from public.wall_entries where user_id=u and is_visible),'pending must stay hidden';
 update public.supports set payment_status='paid',paid_at=now() where id=s;
 assert not exists(select 1 from public.wall_entries where user_id=u and is_visible),'avatar required';
 update public.publicity_profiles set official_avatar_path='qa-avatar.png',avatar_status='ready' where user_id=u;
 assert exists(select 1 from public.wall_entries where support_id=s and is_visible and social_url='https://www.instagram.com/osurtoartificial/'),'optional URL fallback failed';
 assert exists(select 1 from public.wall_entries where support_id=s and wall_month=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date),'month mapping failed';
 insert into public.appearances(support_id,status,published_at) values(s,'published',now());
 assert exists(select 1 from public.wall_entries where support_id=s and published_appearances=1),'hall count failed';
 insert into public.supports(id,user_id,tier,billing_mode,minimum_amount,amount,payment_status,payment_provider,paid_at)
 values(f,u,'free','one_time',1,10,'paid','qa_rollback',now());
 assert not exists(select 1 from public.wall_entries where support_id=f and is_visible),'free support must remain anonymous';
 update public.supports set payment_status='refunded' where id=s;
 assert not exists(select 1 from public.wall_entries where user_id=u and is_visible),'refund must hide entry';
 assert not has_column_privilege('authenticated','public.profiles','role','update'),'role escalation';
 assert not has_column_privilege('authenticated','public.publicity_profiles','official_avatar_path','update'),'avatar approval escalation';
end; $$;
select 'PASS pending/paid/avatar/optional social URL/month/hall/refund/free support/security; rolled back' as result;
rollback;
