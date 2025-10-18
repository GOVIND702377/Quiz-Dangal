## auto-push (Edge Function)

Purpose: Run on a schedule (e.g., every minute) to send automatic push notifications to participants only.

Behavior:
- Start-soon: For quizzes starting within 1 minute and not yet pushed, sends `type: 'start_soon'` to `participants:<quiz_id>`.
- Result: For visible results not yet pushed, sends `type: 'result'` to `participants:<quiz_id>`.

Auth:
- Uses `SERVICE_ROLE` internally to read views and mark RPCs.
- Calls `send-notifications` with header `X-Cron-Secret` that must match `CRON_SECRET` set in both functions.

Scheduling:
- Configure Supabase Function Schedule (or any external scheduler) to POST this endpoint every minute.
# Edge Functions

This folder contains Deno Edge Functions deployed via Supabase.

- send-notifications: Admin-triggered broadcast push notifications with VAPID/Web Push.
- ai-orchestrator: Backend-only AI quiz generation orchestration with provider failover and alerting.

 ai-orchestrator
 Purpose: Create scheduled quiz jobs per category based on settings (cadence, live window) and generate quizzes using configured AI providers with failover. If all providers fail, it does NOT create any fallback quiz; it only logs and sends alert emails.

 Auth/Secrets:
 - Uses SERVICE_ROLE to read/write across protected tables (jobs/logs/quizzes). Set via function secrets.
 - Requires Supabase project env in the function:
	 - SUPABASE_URL
	 - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)
	 - CRON_SECRET (requests MUST include header `X-Cron-Secret` with this exact value)
	 - Optional: RESEND_API_KEY, RESEND_FROM (for email alerts fallback if DB RPC not available)

 Scheduling:
 - Create a schedule in Supabase Dashboard (or any secure scheduler) to POST this function every minute with header `X-Cron-Secret: <your-secret>`.
 - The orchestrator aligns work to settings.cadence_min internally, so a 1-minute schedule is safe.
 - Nightly cleanup: schedule another call with query `?task=cleanup` once per day (e.g., 22:00 UTC ≈ 03:30 IST).

 Database:
 - Apply migration supabase/migrations/202510181315_ai_quiz_automation.sql to create ai_settings, ai_providers, ai_generation_jobs, ai_generation_logs, with admin-only RLS.
 - Also apply supabase/migrations/202510181500_ai_functions_search_path.sql to harden function search_path for linters.

 Admin UI:
 - The Admin page includes an "automation" tab to manage AI settings and providers.
 - Provider names recognized by the orchestrator: `openai`, `groq`, `anthropic` (or `claude`).

Do NOT commit supabase/.temp or supabase/.branches folders — these are local CLI state.