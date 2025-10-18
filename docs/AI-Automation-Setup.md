## AI Automation Setup (Production)

Follow these steps to enable backend-only AI quiz generation. No API keys are committed; add them via Admin panel later.

1) Apply Migrations
- Run both migrations in Supabase SQL editor or via CLI:
  - supabase/migrations/202510181315_ai_quiz_automation.sql
  - supabase/migrations/202510181500_ai_functions_search_path.sql

2) Deploy Edge Functions
- Deploy `ai-orchestrator` and `admin-upsert-questions` (optional helper used by Admin panel).
- Set function environment variables for `ai-orchestrator`:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - CRON_SECRET
  - Optional: RESEND_API_KEY, RESEND_FROM

3) Create Schedules
- Generation: Every 1 minute. Add header `X-Cron-Secret: <CRON_SECRET>`.
- Cleanup: Daily, call with `?task=cleanup` and the same secret header.

4) Configure in Admin Panel
- Settings defaults: cadence_min=10, live_window_min=7, cleanup_days=3. For 5-minute quizzes with a 5-minute gap set cadence_min=10 and live_window_min=5.
- Categories: e.g., opinion,gk,sports,movies.
- Alert emails: your ops addresses.
- Providers: add names `openai`, `groq`, or `anthropic` (or `claude`) with priority; paste API keys. You can disable/enable providers anytime.

Notes
- If providers fail, the orchestrator does NOT create any fallback quiz. It logs the error and sends alert emails.
- Opinion category produces no correct answers; other categories enforce exactly one correct option per question.
- Three slots are maintained per category: current (skipped if too close), next, and next-next. Example: with cadence=10 and live_window_min=5, slots look like 1:00–1:05 (live), 1:10–1:15 (upcoming), and 1:20–1:25 (next upcoming).
