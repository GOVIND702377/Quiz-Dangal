This folder is kept only for documentation/context.

- All database behavior is defined and managed exclusively via migrations under `supabase/migrations/`.
- The old `supabase/sql/functions/` helpers were editor-only and have been removed to prevent drift. Please do not add ad‑hoc SQL files here.
- If you need a one‑off maintenance query: run it via the SQL editor temporarily, then codify the change as a proper migration so schema stays in sync across environments.

Applied manual fix (Oct 8, 2025):
- Granted anon read access (columns: id, username, avatar_url) on `public.profiles` and added a select RLS policy `profiles_public_read`.
- Purpose: fix "permission denied for table profiles" for public RPCs (`is_username_available`, `profiles_public_by_ids`).
- If a new environment needs this, re-run the migration content from `20251008101500_fix_public_profiles_read.sql` (now removed as requested).
