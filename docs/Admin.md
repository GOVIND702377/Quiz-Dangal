# Admin Panel (Unified `Admin.jsx`)

This document explains the current admin dashboard architecture after unifying everything into a single `src/pages/Admin.jsx` file (previous temporary `AdminClean.jsx` removed).

## Overview
Originally the legacy `Admin.jsx` had become corrupted (thousands of lines, duplicated logic). A clean rewrite was done as `AdminClean.jsx`; now that code has been merged back and only one file remains: `src/pages/Admin.jsx`.

Key goals of the unified file:
- Keep surface area lean & readable.
- Separate helpers (parsers / constants) at top.
- Easy future extraction into smaller components if it grows.

## Main Responsibilities
1. Create quizzes (title, category, prize metadata, schedule).
2. Add questions either via form or raw pasted bulk syntax.
3. Bulk insert / upsert questions (RPC `admin_bulk_upsert_questions` if present, else fallback inserts).
4. Delete quizzes (only before start time) and recompute results (`admin_recompute_quiz_results`).
5. List quizzes: active/upcoming vs finished.
6. Send push notifications to user base (via Edge Function `send-notifications`).
7. Moderate redemptions (approve / reject with reason) invoking SQL functions `approve_redemption` & `reject_redemption`.
8. Track refer & earn metrics: profile counters (`referral_count`, `played_quizzes`, `quiz_won`) now auto-sync via triggers, so admin exports and dashboards always reflect the latest numbers without manual backfills. Referral bonuses now credit both `total_coins` and `wallet_balance`, and a migration keeps historic balances aligned with `total_coins - total_spent`.

## Key Files
- `src/pages/Admin.jsx` – Single source of truth (contains former AdminClean implementation).
- `src/lib/customSupabaseClient.js` – Exports named `supabase` + `hasSupabaseConfig`.

## State Structure
- `quizzes`: array of quiz rows (partial columns).
- `questionsDraft`: builder array for new quiz questions (each: `{ text, options[], correctIndex }`).
- `quizForm`: object for quiz creation (title, category, prizes[], prize_type, start/end time, bulk_text).
- `busyQuizId`: quiz currently undergoing recompute.

## Bulk Question Paste Format
Accepted markers:
```
Q1. Capital of India?
- [ ] Mumbai
- [x] Delhi
- [ ] Kolkata
- [ ] Jaipur

Q2. Best color?
- [x] Blue
- [ ] Red
Answer: A
```
Supports tick `[x]` or trailing `Answer: A/B/1/2` lines. Opinion category allows zero correct; others enforce exactly one.

## Security / Access
- Frontend must ensure only admin users mount this page (currently handled via auth context + role checks – verify RLS server-side).
- All Supabase RPCs used for admin operations (`admin_bulk_upsert_questions`, `admin_recompute_quiz_results`) must enforce `auth.role() = 'service_role'` or explicit admin check internally; do not rely solely on client gating.

## Tabs Summary
| Tab | Purpose | Key Actions |
|-----|---------|-------------|
| overview | Quiz CRUD & listing | Create quiz, view questions, recompute, delete |
| notifications | Send push + list recent notifications | POST to edge function, fetch last 100 rows |
| redemptions | Approve / reject user redemption requests + manage rewards catalog | Filter status, approve/reject, create/edit/activate rewards |

### Notifications Panel
Implementation details:
- Form fields: title (<=80 chars), message (<=280 chars), segment (currently only `all`).
- Sends POST to `/functions/v1/send-notifications` with bearer token (user session) for auth.
- After success reloads latest 100 `notifications` ordered desc.
- Displays created_at timestamp and segment.

Edge Function expectations:
```jsonc
{ "title": "Win Big", "message": "Daily quiz starts now", "segment": "all" }

Targeting participants of a specific quiz
### Setup and Scheduling (Required for Auto Push)

- You can now target only the users who joined a quiz by using a segment string of the form `participants:<quiz_uuid>`.
- Example body:


- Deploy Edge Functions:
	- `send-notifications`
	- `auto-push` (optional if you use the Node cron script instead)
- Set env vars for both functions:
	- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
	- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CONTACT_EMAIL` (or `VAPID_CONTACT_EMAIL`)
	- `CRON_SECRET` (same value in both functions and any external cron)
	- `ALLOWED_ORIGINS` (include prod and localhost for testing)
- Schedule every minute:
	- Option A (recommended): Supabase Function Schedule → call `auto-push`
	- Option B: External cron (GitHub Actions/VM) → run `node scripts/auto-push.mjs`

### Targeting Rules

- Broadcast to all: `segment = 'all'` or leave empty
- Participants of a quiz only: `segment = 'participants:<quiz_uuid>'`

### Click-through URLs

- If no `url` is provided in payload and `quizId` is known, defaults are applied:
	- `type: 'start_soon'` → `/quiz/<quiz_id>`
	- `type: 'result'` → `/results/<quiz_id>`

### Smoke Test Checklist

1) Subscribe: Login → after 10s prompt, allow notifications. Ensure `push_subscriptions` row exists and `profiles.notifications_enabled = true`.
2) Admin broadcast: Send a test from this panel (segment `all`) → push should arrive; row appears in `notifications`.
3) Start soon: Create quiz starting in ~2 minutes, join it → within 1 minute before start, start push should arrive; `quizzes.start_push_sent_at` set.
4) Result: Let quiz end → compute results → result push should arrive; `quiz_results.result_push_sent_at` set.
```
{ "title": "Quiz starts soon", "message": "Join now!", "type": "start_soon", "segment": "participants:00000000-0000-0000-0000-000000000000", "quizId": "00000000-0000-0000-0000-000000000000" }
```

Notes

- When `segment` is of the form `participants:<quiz_uuid>`, only those users' push subscriptions are targeted.
- The Edge Function will include `quizId` in the push payload (either from the body or derived from the segment), and the service worker already handles `type: 'start_soon' | 'result'` for better UX.
- Leaving `segment` empty or set to `all` sends to all subscribers (broadcast).

Automation (no admin action)

- DB adds idempotency columns: `quizzes.start_push_sent_at`, `quiz_results.result_push_sent_at`.
- Views:
	- `v_start_soon_due`: quizzes starting within 1 minute and not pushed yet.
	- `v_result_push_due`: results visible and not pushed yet.
- Marking idempotency: The automation marks `quizzes.start_push_sent_at` and `quiz_results.result_push_sent_at` directly after sending.
- External scheduler: run `scripts/auto-push.mjs` every minute with env:
	- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (also set same `CRON_SECRET` in Edge Function env).
	- Script calls Edge `send-notifications` in `mode: 'cron'` with `X-Cron-Secret` for auth and uses `participants:<quiz_id>` targeting.

Quiz finalization cron

- Supabase cron job `finalize-due-quizzes` should execute `SELECT public.run_finalize_due_quizzes(100);` every minute.
- The `20251009173000_fix_finalize_due_quizzes.sql` migration refreshes `public.finalize_due_quizzes`, ensuring it checks `end_time` and marks quizzes `completed` after computing results and awarding coins.
- If quizzes stay stuck, run the RPC manually from the SQL editor to surface errors; the function now logs failures via `RAISE NOTICE` so you can review the Postgres logs for specifics.
```
Extensibility: Add new segment types (e.g. category, winners) by extending both function's filtering logic and UI segment buttons.

### Redemptions Panel
Implementation details:
- Fetches from `redemptions` (columns: id,user_id,reward_type,reward_value,status,created_at,processed_at,reject_reason) limited 200 recent.
- Filter buttons: pending / approved / rejected / all.
- Pending rows allow Approve (calls `approve_redemption(p_redemption_id uuid)`) or Reject (calls `reject_redemption(p_redemption_id uuid, p_reason text)`).
- Reject requires a reason (textarea) - stored in `reject_reason` and visible after rejection.
- Uses minimal optimistic UI (full reload after action keeps logic simple and safe).

#### Rewards Catalog Management
Added beneath redemptions table.
- Table: `reward_catalog` (id uuid, reward_type text, reward_value text, coins_required integer, is_active boolean, created_at, updated_at).
- Create / edit form (toggles via “New Reward” / Edit); fields: Type, Value, Coins Required, Active.
- Activate/Deactivate toggles `is_active`.
- RLS: public SELECT only when `is_active = true` (admins can see all); INSERT/UPDATE/DELETE allowed only for admins via `is_admin()`.
- Future: enrich `reward_catalog` with optional `title/description/image_url` and link redemptions to a reward id (FK) while snapshotting fields for history.

### Recommended Future Enhancements
1. Pagination & search for quizzes and redemptions (cursor or keyset pagination for performance).
2. Segment builder for notifications (categories, active quiz participants, winners, inactive users >7 days).
3. Optimistic updates with rollback on error for approve/reject and reward edits.
4. Skeleton loaders / virtualization for large tables.
5. Telemetry & audit log (who approved/rejected, who sent which notification) – separate `admin_events` table.
6. Link redemptions to `rewards_catalog` via foreign key and denormalize snapshot fields for historical integrity.
7. Centralize constants (categories, prize types, reward types) as DB enums + generated TypeScript types.
8. Role-based gating in UI (hide panels for non-super admins if tiered roles introduced).

## Legacy Cleanup
Legacy placeholder file has been removed; only `Admin.jsx` remains.

## Maintenance Rules
- Keep `Admin.jsx` focused; if it exceeds ~500 lines extract panels (e.g., `AdminNotificationsPanel.jsx`).
- Add new heavy features as child components & lazy load if needed.
- Avoid in-file anonymous IIFEs for large blocks; extract helpers.
- Validate migrations add proper RLS / privileges before relying on new columns.

## Troubleshooting
Issue: RPC not found → Fallback path inserts questions individually. Consider adding detection & warning toast.
Issue: Duplicate legacy code resurfacing → Ensure IDE isn’t restoring from local history; verify git diff.
Issue: Unauthorized errors → Confirm JWT role claims and RLS policies on `quizzes/questions/options` tables.

## Contact / Ownership
Primary maintainers: (Update with actual team names/emails.)

---
Generated on: 2025-10-08 (updated with Notifications & Redemptions panels)

## Results & Awards operations (admin)

- Compute and show results for a finished quiz:
	- Panel button: Recompute (calls `admin_recompute_quiz_results(p_quiz_id)`)
	- Server-side award (coins) auto-triggers if `prize_type='coins'` or numeric prizes exist.

- Batch finalize due quizzes (server):
	- `SELECT public.finalize_due_quizzes(100);` — processes up to 100 finished quizzes.

- One-off fix for old quizzes created with `prize_type='money'` but numeric prizes:
	- Convert to `coins` by heuristic and rerun finalize:

		UPDATE public.quizzes q
		SET prize_type = 'coins'
		WHERE prize_type IS DISTINCT FROM 'coins'
			AND EXISTS (
				SELECT 1
				FROM jsonb_array_elements_text(COALESCE(q.prizes,'[]'::jsonb)) AS e(txt)
				WHERE txt ~ '^[0-9]+$' AND length(txt) > 0
			);

		UPDATE public.quizzes q
		SET prize_type = 'coins'
		WHERE prize_type IS DISTINCT FROM 'coins'
			AND EXISTS (
				SELECT 1 FROM public.quiz_prizes p
				WHERE p.quiz_id = q.id AND p.prize_coins > 0
			);

		SELECT public.finalize_due_quizzes(100);

- Idempotency: Duplicate rewards are prevented by unique partial index `uniq_quiz_reward_once`.

