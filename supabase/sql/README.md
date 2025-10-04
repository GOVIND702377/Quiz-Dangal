This folder holds optional SQL utilities for Supabase.

- `2025-10-hardening.sql`: full safety/analytics migration. Run once to deploy the wallet, leaderboard, and policy fixes.
- `2025-10-linter-remediation.sql`: lightweight follow-up that only addresses Supabase database advisor warnings. Use this if you already applied the hardening script and only need to clear the linter alerts. The extension relocation step auto-skips when the current role is not the owner, so non-owner roles will merely see a NOTICE. Privilege revokes/grants are object-agnostic (no explicit MATERIALIZED VIEW keyword) to avoid parser quirks across Postgres versions, and policy adjustments only run when the canonical policies already exist (otherwise the script emits a NOTICE and leaves your custom RLS untouched).
