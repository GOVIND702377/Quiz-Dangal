# Security Remediation Checklist

This repository previously included sensitive Supabase data exports and automation gaps. Use the checklist below to complete the clean-up.

## 1. Credentials
- [ ] Rotate the Supabase service-role key exposed in the old `backups/supabase_backup.sql` dump.
- [ ] Update all serverless functions, cron scripts, and CI secrets with the new key.
- [ ] Invalidate any other API keys that may have been shared in logs or dumps.

## 2. Git history scrub
- [ ] Run `git rm backups/supabase_backup.sql` locally (the file is still present in the working tree while we coordinate its removal).
- [ ] Use `git filter-repo` or BFG to delete the file from the entire history, then force-push to the remote.
- [ ] Share the force-push notice with collaborators so they can re-clone or run the same filter.

## 3. Database automation
- [ ] Apply the migration `20251009173000_fix_finalize_due_quizzes.sql` and confirm cron job **finalize-due-quizzes** processes pending quizzes.
- [ ] Run `SELECT public.run_finalize_due_quizzes(100);` manually once after deployment and verify logs for any `NOTICE` lines.
- [ ] Review job history (`cron.job_run_details`) to ensure no recurring errors remain.

## 4. RLS & policies
- [ ] Audit Supabase policies for `referrals`, `reward_catalog`, `transactions`, and `job_runs`, ensuring only the intended roles can read/write sensitive tables.
- [ ] Confirm all SECURITY DEFINER functions set `SET search_path TO 'public','pg_temp'` (recent migrations already enforce this).
- [ ] Verify no public access to materialized views (`mv_*`) except service roles.

## 5. Incident follow-up
- [ ] Document the timeline of exposure and notify affected stakeholders.
- [ ] Enable monitoring for suspicious wallet/redemption activity around the exposure window.
- [ ] Schedule a quarterly secret scan (e.g. `scripts/scan-dist-secrets.mjs`) as part of CI to prevent regressions.

Once every box is checked, replace this file’s checklist with a short summary of actions taken and their dates.
