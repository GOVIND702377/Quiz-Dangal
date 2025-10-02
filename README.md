# Quiz Dangal

Ek modern quiz web app jo Supabase (Auth + DB + Edge Functions), React (Vite), aur PWA features ka use karta hai. Is README me Hindi-first guidance diya gaya hai taaki setup aur deployment asaan ho.

## Features
- User Auth (Supabase)
- Quizzes (participation, answers, results)
- Leaderboards (daily/weekly/all-time)
- Wallet & Rewards (coins, redemptions)
- Referrals (bonus logic)
- Admin tools (notifications, recompute results)
- PWA (offline cache, installable)
- Push Notifications (Web Push + VAPID)

## Tech Stack
- Frontend: React 18 + Vite 4 + TailwindCSS + Radix UI
- Backend: Supabase (Postgres + RLS), Edge Function (Deno)
- Push: Web Push (VAPID)
- Build/Deploy: Static build (dist/) + custom domain (CNAME)

## Folder Structure (short)
- `src/` – React code
  - `pages/` – App pages (Home, Quiz, Results, Profile, Leaderboards etc.)
  - `components/` – UI components (Header, Modals, etc.)
  - `contexts/` – Supabase Auth context
  - `hooks/` – Push notifications hook
  - `lib/` – client helpers (Supabase client)
- `public/` – Assets + `sw.js` (Service Worker)
- `supabase/functions/` – Edge functions (e.g., send-notifications)
- Root configs: `vite.config.js`, `tailwind.config.js`, `postcss.config.js`

## Prerequisites
- Node.js 18+ (recommended)
- npm 9+
- Supabase project (URL + keys)
- Windows PowerShell users: commands yahi shell ke hisaab se likhe gaye hain

## Local Setup
1) Dependencies install
- `npm install`

2) Environment variables (Frontend)
Project root me `.env` banayein (ya existing update karein):
- `VITE_SUPABASE_URL` = aapke Supabase project ka URL
- `VITE_SUPABASE_ANON_KEY` = Supabase anon key
- `VITE_VAPID_PUBLIC_KEY` = Web Push VAPID public key
- Optional: `VITE_BYPASS_AUTH=1` (sirf local UI testing ke liye; auth flows disable ho jayenge)

3) Supabase Function Secrets (Backend)
Supabase dashboard me function secrets set karein:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CONTACT_EMAIL` (e.g., mailto:notify@example.com)
- `ALLOWED_ORIGIN` (prod domain; default `https://quizdangal.com`)

4) Dev server
- `npm run dev`
- LAN testing (same WiFi me dusre device par): `npm run dev:lan`

5) Production build/preview
- Build: `npm run build`
- Preview: `npm run preview`

## PWA Notes
- `public/sw.js` service worker install ke baad assets cache karta hai.
- Naya deploy aane par users ko ek-do refresh se latest SW mil jata hai.
- SW update force karne ke liye browser DevTools → Application → Service Workers me “Update/Unregister” use kar sakte hain.

## Push Notifications
- Frontend: `usePushNotifications` hook login guard ke saath subscription create karta hai (user ko pehle login hona zaroori hai).
- Backend: `supabase/functions/send-notifications/index.ts` me admin-only notification send workflow hai.
- VAPID keys set hone zaroori (frontend/public + backend/private).
- CORS: function me `ALLOWED_ORIGIN` se restrict kiya gaya hai (default: `https://quizdangal.com`). Local test ke liye is value ko `http://localhost:5173` par temporarily set kar sakte hain.

Notification bhejne ka high-level flow:
- Admin user client se function ko call karta hai (Authorization header ke saath).
- Function admin role verify karke `push_subscriptions` table ke endpoints par notifications bhejta hai.
- Invalid endpoints 404/410 par auto-clean ho jate hain.

## Prize Data Normalization (Quizzes)

Quizzes ki prize distribution ko normalized table `public.quiz_prizes` me store kiya jata hai (rank ranges + per-rank coins). Frontend compatibility ke liye `public.quizzes.prizes` (top-3 array) aur `public.quizzes.prize_pool` ko triggers ke through auto-sync rakha gaya hai.

Migration SQL: `supabase/sql/2025-09-30_prize_normalization.sql`

Isse yeh hoga:
- `quiz_prizes` par sanity constraints add
- Triggers: `quizzes.prizes` -> `quiz_prizes` rows; `quiz_prizes` -> `quizzes.prize_pool` + top-3 prizes
- View: `public.quizzes_enriched` with computed `prize_pool_calc` and `prizes_top3`
- RLS: `quiz_prizes` public read, admin manage

Frontend ko change karne ki zaroorat nahi (wo `quizzes` se hi `prize_pool`/`prizes` padhta hai). Agar aap computed fields chahte hain to `quizzes_enriched` view use kar sakte hain.

## Results computation (opinion vs knowledge)

- Opinion quizzes: Inmein koi "correct" option nahi hota. Har question pe majority vote ko winner option mana jata hai. Jo users majority option select karte hain unko 1 point milta hai. Ranking tie-breaker: matching answers ka average answer time (jaldi waley upar).
- Knowledge quizzes (gk, movies, sports): Score = sahi answers ki count. "Sahi" ka signal `public.options.is_correct = true` se aata hai. Tie-breaker: jis time pe user ne last correct answer complete kiya (jaldi complete karne wale upar).

DB Functions
- `public.compute_quiz_results(quiz_id)`: Leaderboard jsonb compute karta hai aur `public.quiz_results` me upsert karta hai.
- `public.admin_recompute_quiz_results(quiz_id)`: Admin-only wrapper.
- `public.finalize_due_quizzes(p_limit)`: Jin quizzes ka result_time nikal gaya hai unke results compute karta hai.

Deployment
1) Supabase SQL Editor me `supabase/sql/quiz_results_functions.sql` ka content run karein, ya psql se apply karein.
2) Admin panel se "Recompute Results" use karke kisi quiz par verify karein.
3) Opinion category ki questions me sab options `is_correct = false` rehne chahiye. Knowledge categories me exactly 1 option `is_correct = true` hona chahiye (UI enforce karta hai).

## Deployment
- Static site ke liye `npm run build` se `dist/` generate hota hai.
- Custom domain (`public/CNAME`) ke saath base `'/'` configured hai (`vite.config.js`).
- GitHub Pages ya kisi static host par `dist/` serve kar sakte hain.
- Supabase Edge Functions ko Supabase project me deploy aur secrets configure karna zaroori hai.

## Security & Backup (IMPORTANT)
- `supabase_backup.sql` destructive dump hai: isme pehle DROP aur fir CREATE hota hai (auth.*, tables, policies sab). Isse production me direct mat chalayein.
- Is script ko sirf nayi/blank ya staging environment me test/restore karein.
- Backup file me kisi bhi tarah ke secrets/api_key literals ko commit se pehle scrub/placeholder karna best practice hai.
- Schema changes ke liye Supabase CLI migrations prefer karein.

## Troubleshooting
- 401/403 on send-notifications: ensure user admin hai aur function secrets sahi set hain.
- CORS blocked: `ALLOWED_ORIGIN` me aapka domain/localhost add karein.
- Push subscribe fail: login required, notification permission denied, ya VAPID keys missing.
- Stale UI/old assets: service worker update ke baad hard refresh/close-open karein.
- Env missing: frontend `.env` me `VITE_*` vars aur backend function secrets check karein.

## Scripts (quick)
- Dev: `npm run dev` (LAN: `npm run dev:lan`)
- Build: `npm run build`
- Preview: `npm run preview` (LAN: `npm run preview:lan`)

---
Agar aapko multi-origin CORS whitelist (prod + localhost) chahiye, edge function me uska support add kiya ja sakta hai. Push flow, referrals, ya leaderboards par aur docs chahiye ho to batayein, hum expand kar denge.

## Static Share Poster (Brand)

Refer & Earn aur Results pages ab ek hi static brand poster image share karte hain (plus personalized caption). Configure karne ke do tarike:

1) Public file (recommended)
- Poster ko `public/refer-poster.png` ke naam se rakhein.
- App runtime me is file ko absolute URL se fetch karta hai, aur cache-busting query (`?v=<timestamp>`) add karta hai taa ki PWA/CDN cache bypass ho jaye.

2) CDN URL via env
- `.env` me set karein: `VITE_REFER_POSTER_URL=https://cdn.example.com/path/to/poster.png`
- Absolute URL hona chahiye (http/https). App is URL par bhi cache-busting add karta hai.

Compatibility notes
- Agar poster PNG/JPG nahi hai (e.g. WebP/SVG), to runtime pe JPEG me convert karke share kiya jata hai, kyunki kuch apps JPEG ke saath zyada reliable hoti hain (specially iOS/WhatsApp).
- Agar poster file nahi milti, app last-resort ek chhota JPEG generate karta hai taa ki share me hamesha image attach ho.
