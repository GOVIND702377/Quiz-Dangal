Ad-hoc SQL folder (now cleaned)

All database behavior is defined and managed via versioned migrations under `supabase/migrations/`.

Removed obsolete helper scripts after successful migration push:
- 2025-10-14_redemptions_payout.sql (duplicate of migration)
- 2025-10-14_notifications_enabled_fix.sql (duplicate of migration)


Their logic lives in migrations:
- 202510141200_redemptions_payout.sql
- 202510141205_notifications_enabled_fix.sql
- Later patch / grant migrations

Guidelines:
1. Prefer creating a migration instead of dropping raw SQL here.
2. If you must run a one-off production hotfix, create the script, execute, then immediately transform into a migration and delete the ad‑hoc script.
3. Keep this directory empty or documentation-only to avoid schema drift.

Historical note (Oct 8, 2025): public profiles read access & policy fix was migrated (see removed migration `20251008101500_fix_public_profiles_read.sql`).
