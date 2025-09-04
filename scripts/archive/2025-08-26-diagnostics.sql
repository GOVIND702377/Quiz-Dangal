-- Quiz Dangal: Environment/Settings Snapshot (READ-ONLY)
-- Paste this into Supabase SQL editor to view current setup.

-- 0) Context
SELECT current_user, current_database() AS db, current_schema AS schema;
SELECT now() AS now_utc, current_setting('TimeZone') AS timezone;
SELECT auth.uid() AS auth_uid, auth.role() AS auth_role;

-- 1) Extensions
SELECT e.extname, e.extversion, n.nspname AS schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 2) Tables + RLS status (public + storage)
SELECT n.nspname AS schema, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       obj_description(c.oid,'pg_class') AS comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind = 'r'
ORDER BY schema, table_name;

-- 3) RLS Policies (public + storage)
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','storage')
ORDER BY schemaname, tablename, policyname;

-- 4) Triggers (exclude internal)
SELECT n.nspname AS schema, c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage')
ORDER BY schema, table_name, trigger_name;

-- 5) Functions/Procedures (public)
SELECT n.nspname AS schema, p.proname AS routine,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS returns,
       l.lanname AS language, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
ORDER BY routine;

-- 6) Views (public)
SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 7) Materialized Views (public)
SELECT schemaname, matviewname, definition
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- 8) Indexes (public)
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 9) Constraints (public)
SELECT n.nspname AS schema, c.relname AS table_name,
       con.conname AS constraint_name, con.contype,
       pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY schema, table_name, constraint_name;

-- 10) Publications (realtime etc.)
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication
ORDER BY pubname;

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
ORDER BY pubname, schemaname, tablename;

-- 11) Storage buckets + policies
SELECT id, name, public
FROM storage.buckets
ORDER BY name;

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- 12) Sequences (public)
SELECT sequence_schema, sequence_name, data_type, start_value, minimum_value, maximum_value, increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- 13) pg_cron jobs (if extension enabled)
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobid;

SELECT jobid, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY end_time DESC
LIMIT 20;
