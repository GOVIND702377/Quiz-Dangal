# Supabase Edge Functions

This directory now contains the functions that support manual quiz administration:

- `admin-upsert-questions` – service-role helper that bulk inserts or replaces quiz questions invoked from the admin panel.
- `send-notifications` – sends push notifications when an admin triggers a broadcast; optional cron mode is available via `{ mode: 'cron' }` if you still schedule reminders.

Do NOT commit `supabase/.temp` or `supabase/.branches` folders — these are local CLI state.