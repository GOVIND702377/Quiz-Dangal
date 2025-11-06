## Automation Setup (Non‑AI, Free)

Yeh guide batata hai kaise bina AI providers ke quizzes auto‑generate kiye jaa sakte hain (RSS + Wikipedia + LibreTranslate). Kisi API key ki zaroorat nahi.

1) Migrations apply karein
- Supabase SQL editor/CLI se run:
  - supabase/migrations/202510181315_ai_quiz_automation.sql
  - supabase/migrations/202510181500_ai_functions_search_path.sql

2) Edge Functions deploy
- `ai-orchestrator` (ye ab non‑AI RSS/Wikipedia based generation bhi karta hai)
- `send-notifications` (push ke liye)
- `auto-push` (participants targeting automation)

3) Function environment variables
- Required (orchestrator & notifications):
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - CRON_SECRET
  - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL (push ke liye)
  - ALLOWED_ORIGINS (prod + localhost)
- Optional:
  - LIBRE_TRANSLATE_URL (default: https://libretranslate.com)

4) Schedules
- Generation: `ai-orchestrator` ko har 1 minute call karein (header: `X-Cron-Secret: <CRON_SECRET>`)
- Cleanup: daily `?task=cleanup` ke saath same header
- Auto push: `auto-push` ko har 1 minute (same header)

5) Admin → Providers (Non‑AI)
- Ek provider add karein:
  - name: `rss`
  - enabled: true
  - priority: 1 (lowest number = highest priority)
  - api_key: blank (rss keyless hai)
- (Optional aliases) `feeds` ya `noai` bhi use kar sakte hain

6) Categories ka behavior
- opinion: Reddit AskReddit RSS se titles → poll questions (0 correct)
- gk: Wikipedia random summaries → MCQ (exactly 1 correct)
- sports: Wikipedia Category:Sports members
- movies: Wikipedia Category:Films members
- Bilingual formatting: `Hindi (English)` (LibreTranslate fail pe English fallback)

7) Validation rules (strict)
- Exactly 10 questions per quiz
- Exactly 4 options per question
- opinion → sab options incorrect
- baaki categories → exactly 1 correct

Notes
- Public RSS/Wikipedia endpoints—rate limits ka dhyan rakhein. Failures logs me aayenge (`ai_generation_logs`).
- IST blackout: 00:00–08:00 IST me current slot skip hota hai; queue next slots.
- `start_offset_sec` lead time maintain karta hai taa ki start-time edits pe race na ho.
