do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'supporter-email-processor-every-10-minutes';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end $$;

select cron.schedule(
  'supporter-email-processor-every-10-minutes',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' order by created_at desc limit 1)
      || '/functions/v1/supporter-email-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-surto-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret' order by created_at desc limit 1)
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $job$
);
