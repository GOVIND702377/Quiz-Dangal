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

Do NOT commit supabase/.temp or supabase/.branches folders — these are local CLI state.