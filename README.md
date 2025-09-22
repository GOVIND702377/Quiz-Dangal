# Quiz Dangal

A fast, opinion-based quiz PWA built with React + Vite + Tailwind, using Supabase for auth, data and push notifications.

## Local setup

1. Create `.env` in project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional: if you don't want auth locally, bypass it
# VITE_BYPASS_AUTH=1
# Optional: Web Push
# VITE_VAPID_PUBLIC_KEY=your_web_push_vapid_public_key
```

2. Install deps and run dev server.

3. Optional: build and preview.

## Notable improvements

- Route-based code splitting with React.lazy for faster initial load.
- Minimal service worker with safe network-first for app code and cache-first for static assets.
- Hardened Supabase auth context: resilient session handling, safe profile upsert, referral processing via RPC.
- Tailwind content globs simplified to `./src/**/*` for smaller CSS output.
- Unused code removed (brand helpers, legacy stubs kept minimal).

## Supabase alignment

Frontend uses the following tables/RPC functions (present in schema):
- Tables: `profiles`, `quizzes`, `questions`, `options`, `referrals`, `notifications`, `push_subscriptions`.
- RPC: `handle_daily_login`, `join_quiz`, `get_leaderboard`, `handle_referral_bonus`, `save_push_subscription`, `create_notification`.

Ensure RLS policies match app expectations (users can read quizzes, questions/options for joined quizzes; update own profile; insert their push subscription, etc.).

## Deployment

- Built with Vite, output in `dist/`. Configure your host to serve `index.html` for all routes (SPA) and the `public/sw.js` service worker at site root.

## Troubleshooting

- If you see a blank screen, check the browser console for missing `.env` Supabase keys or SW registration errors.
- For push, ensure VAPID public key is configured and your backend Cloud Function `send-notifications` is deployed.