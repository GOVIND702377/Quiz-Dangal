# DB Index Cleanup Guide

This guide helps decide which indexes to keep, monitor, or consider dropping based on recent usage metrics. The JSON you shared appears to be from `pg_stat_user_indexes`.

Caveats:
- idx_scan resets on Postgres restart or `pg_stat_reset*` calls. A value of 0 may simply mean "no recorded use since last reset".
- Partial indexes, multi-column orderings, and FKs can be critical even with low scans.
- Always validate with `EXPLAIN (ANALYZE, BUFFERS)` before any removal.

## Strong keep (actively used or clearly critical)
- idx_quiz_results_quiz_id (scans ~24,714)
- idx_quiz_prizes_quiz_id (~2,001)
- idx_options_question_id (~2,032)
- idx_questions_quiz_id (~1,515)
- idx_user_answers_question_id (~1,351)
- idx_quizzes_status_start (~772)
- idx_transactions_user_created (~733)
- idx_user_answers_selected_option (~572)
- ai_providers_priority_idx (~108)
- idx_job_runs_name_started (large, used)
- idx_job_runs_fail_recent (partial, used)
- idx_quiz_results_result_push_due (partial, used)

## Monitor (0–1 scans now, but likely useful)
- ai_generation_logs_job_id_idx (FK coverage) — keep, monitor
- ai_generation_jobs_quiz_id_idx (FK coverage) — keep, monitor
- idx_referrals_referred_id — monitor (referral lookups)
- idx_ai_logs_level — monitor (filtering logs by level)
- ai_generation_jobs_recent_idx (slot_start DESC) — monitor (recent jobs ordering)
- Notifications: idx_notifications_quiz_id, idx_notifications_created_by, idx_notifications_type_created — monitor (depends on queries)
- Redemptions: redemptions_status_requested_at_idx, redemptions_pending_idx (partial), idx_redemptions_user_id, idx_redemptions_catalog_id — monitor (user history, admin views)
- Redemptions: redemptions_payout_identifier_idx, redemptions_payout_channel_idx — monitor; candidates if never filtered
- idx_quiz_participants_user_id — monitor (user participation lookups)
- idx_profiles_referred_by — monitor (referral reporting)
- idx_user_quiz_stats_quiz_id — monitor (stats by quiz)
- idx_ai_jobs_category — monitor (category filters)
- idx_quiz_results_user_id, idx_notifications_created_at — monitor (light usage observed)

## Candidate for drop (after verification)
- idx_ai_providers_enabled_priority — Potentially redundant with `ai_providers_priority_idx` (which shows usage and has a superset of columns). Drop only if query plans never prefer it over the other index.
- The following may become candidates if, after 1–2 weeks, scans remain 0 and EXPLAIN shows no use in hot paths:
  - redemptions_payout_identifier_idx
  - redemptions_payout_channel_idx
  - idx_notifications_quiz_id

## Safety checklist before dropping
- Observe idx_scan for at least 1–2 weeks of normal traffic.
- Search codebase for queries filtering on the candidate columns.
- Run `EXPLAIN (ANALYZE, BUFFERS)` for representative queries; ensure the index isn’t chosen.
- Consider data growth: an index unused today might become valuable as tables grow.
- Drop with `DROP INDEX CONCURRENTLY IF EXISTS schema.index_name;` during low traffic windows. One DROP per transaction.

## Next steps
- Re-run `supabase/sql/report_unused_indexes.sql` weekly and update this list.
- If any index remains unused and verified safe to remove, uncomment it in `supabase/sql/candidate_index_drops.sql` and execute during a maintenance window.
