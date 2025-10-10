# SEO & Performance Playbook

## PageSpeed enhancements (October 2025)
- Critical public pages (`Home`, `Terms & Conditions`, `Privacy Policy`, `Header`) now use lightweight CSS animation utilities instead of `framer-motion`, cutting bundle weight and main-thread work for first paint.
- Home page quiz fetch is deferred via `requestIdleCallback`, allowing the hero content to render before Supabase queries run.
- Reusable animation helpers live in `src/index.css` (`.animate-fade-up`, `.animate-fade-scale`, `.animate-slide-down`, `.animate-fade-left`). Use these for future UI polish without reintroducing heavy JS animation libraries.

## Regenerating the sitemap
Run the helper script whenever routes change or canonical URLs are updated:

```powershell
npm run generate:sitemap
```

The command rewrites `public/sitemap.xml` with the latest public routes. Commit the regenerated file so deployments stay in sync.

## Submitting to Google Search Console
1. Open the Quiz Dangal property in Google Search Console.
2. Navigate to **Indexing ➜ Sitemaps**.
3. Enter `https://quizdangal.com/sitemap.xml` and submit.
4. After successful submission, monitor the **Coverage** report for crawl/index status. Re-submit whenever significant content or routing changes ship.

## Ongoing checklist
- Keep authenticated-only routes (`/profile`, `/wallet`, `/refer`, `/my-quizzes`) tagged with `robots="noindex, nofollow"` via the shared `SEO` component.
- When adding new marketing pages, provide canonical URLs, hreflang data, and structured JSON-LD where relevant.
- Re-run PageSpeed Insights for the landing page after major UI changes; target LCP under 2.5s on 4G/Slow devices.
