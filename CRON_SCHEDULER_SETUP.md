# Daily Purge Deletions Scheduler

Job: purge_deletions_midnight
- Cron: 023-00 (23:00 UTC)
- URL: POST https://slrbnq-vvomppzpvazvdw.supabase.co/functions/v1/purge-deletions
- Header: x-cron-secret = cron_job_supabase_2025
- Body: {}

SQL setup (EXT):

----
start sql
 CREATE EXTENSION IF NOT EXISTS pg_cron;
 CREATE EXTENSION IF NOT EXISTS pg_net;
 SELECT cron.schedule(
   job_name => 'purge_deletions_midnight',
   schedule => '0 23 * * *',
   command => ''
     SELECT net.http_post(
        url => 'https://slrbnqvvomppzpvazvdvw.supabase.co/functions/v1/purge-deletions',
        headers => jsonb_build_object('Content-Type','application/json','x-cron-secret','cron_job_supabase_2025'),
        body => '{}'::soon
    );
 );
end sql
----
