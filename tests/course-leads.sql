-- Run as postgres in one transaction. Synthetic records are rolled back.
begin;
set local role anon;
insert into public.course_leads(channel,contact,consent,website) values('email','codex-sql-test@example.invalid',true,'');
insert into public.course_leads(channel,contact,consent,website) values('whatsapp','+5511000000000',true,'');
do $$ begin
  begin perform contact from public.course_leads; raise exception 'FAIL anonymous read'; exception when insufficient_privilege then null; end;
  begin update public.course_leads set status='coupon_sent'; raise exception 'FAIL anonymous update'; exception when insufficient_privilege then null; end;
  begin delete from public.course_leads; raise exception 'FAIL anonymous delete'; exception when insufficient_privilege then null; end;
  begin insert into public.course_leads(channel,contact,consent,website) values('email','invalid',true,''); raise exception 'FAIL invalid email'; exception when check_violation then null; end;
  begin insert into public.course_leads(channel,contact,consent,website) values('whatsapp','123',true,''); raise exception 'FAIL invalid phone'; exception when check_violation then null; end;
  begin insert into public.course_leads(channel,contact,consent,website) values('email','no-consent@example.invalid',false,''); raise exception 'FAIL consent'; exception when check_violation or insufficient_privilege then null; end;
  begin insert into public.course_leads(channel,contact,consent,website) values('email','trap@example.invalid',true,'spam'); raise exception 'FAIL honeypot'; exception when check_violation or insufficient_privilege then null; end;
  begin insert into public.course_leads(channel,contact,consent,website) values('email','codex-sql-test@example.invalid',true,''); raise exception 'FAIL duplicate'; exception when unique_violation then null; end;
  begin insert into public.course_leads(channel,contact,consent,website,status) values('email','status@example.invalid',true,'','coupon_sent'); raise exception 'FAIL supplied status'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.course_leads) <> 0 then raise exception 'FAIL ordinary user read'; end if;
  update public.course_leads set status='coupon_sent' where contact='codex-sql-test@example.invalid';
  if found then raise exception 'FAIL ordinary user update'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.course_leads where contact='codex-sql-test@example.invalid') <> 1 then raise exception 'FAIL admin read'; end if;
  update public.course_leads set status='archived' where contact='codex-sql-test@example.invalid';
  if not found then raise exception 'FAIL admin update'; end if;
  begin update public.course_leads set contact='rewrite@example.invalid'; raise exception 'FAIL contact overwrite'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: insert both channels, constraints, duplicate, anonymous isolation, ordinary-user isolation, admin read/update, protected columns' as test_result;
rollback;
