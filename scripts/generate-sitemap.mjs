import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.SITEMAP_BASE_URL || 'https://quizdangal.com';
const SKIP = String(process.env.SITEMAP_SKIP || '').trim() === '1';
const EXTRA_ROUTES_FILE = path.resolve(__dirname, '..', 'public', 'sitemap.extra.json');

const ROUTES = [
  // Include homepage if it's public-facing. If you ever gate home behind login, set noindex via extra routes.
  { path: '/', changefreq: 'weekly', priority: 0.9, source: 'src/pages/Home.jsx' },
  { path: '/leaderboards', changefreq: 'weekly', priority: 0.8, source: 'src/pages/Leaderboards.jsx' },
  { path: '/play-win-quiz-app', changefreq: 'weekly', priority: 0.7, source: 'src/pages/PlayWinQuiz.jsx' },
  { path: '/opinion-quiz-app', changefreq: 'weekly', priority: 0.7, source: 'src/pages/OpinionQuiz.jsx' },
  { path: '/refer-earn-quiz-app', changefreq: 'weekly', priority: 0.7, source: 'src/pages/ReferEarnInfo.jsx' },
  // NOTE: '/refer' is an internal referral landing for authenticated users; exclude from sitemap
  { path: '/about-us', changefreq: 'monthly', priority: 0.6, source: 'src/pages/AboutUs.jsx' },
  { path: '/contact-us', changefreq: 'monthly', priority: 0.6, source: 'src/pages/ContactUs.jsx' },
  { path: '/terms-conditions', changefreq: 'yearly', priority: 0.5, source: 'src/pages/TermsConditions.jsx' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: 0.5, source: 'src/pages/PrivacyPolicy.jsx' },
];

const pad = (value) => String(value).padStart(2, '0');
const formatDate = (date) => {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return `${year}-${month}-${day}`;
};

const today = formatDate(new Date());

const toUrl = (loc) => {
  if (!loc) return HOST;
  if (loc.startsWith('http://') || loc.startsWith('https://')) return loc;
  return `${HOST.replace(/\/$/, '')}${loc.startsWith('/') ? '' : '/'}${loc}`;
};

async function resolveLastModified(route) {
  if (route.lastmod) return route.lastmod;
  if (!route.source) return today;
  try {
    const abs = path.resolve(__dirname, '..', route.source);
    const stat = await fs.stat(abs);
    return formatDate(stat.mtime);
  } catch (err) {
    console.warn(`sitemap: could not read mtime for ${route.source}:`, err?.message || err);
    return today;
  }
}

async function loadExtraRoutes() {
  try {
    const raw = await fs.readFile(EXTRA_ROUTES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('sitemap: unable to read sitemap.extra.json:', err?.message || err);
    }
    return [];
  }
}

async function buildSitemap() {
  const extraRoutes = await loadExtraRoutes();
  const allRoutes = [...ROUTES, ...extraRoutes]
    .filter((route) => !route?.noindex)
    .filter((route) => route?.path !== '/refer');

  const xmlItems = await Promise.all(allRoutes.map(async (route) => {
    const changefreq = route.changefreq || 'monthly';
    const priority = route.priority ?? 0.5;
    const loc = route.loc || route.path;
    const lastmod = await resolveLastModified(route);
    const url = toUrl(loc);
    // Add hreflang only for home for now; extendable via route.hreflang
    const hreflang = (loc === '/' || route.hreflang) ? [
      { lang: 'en', href: url },
      { lang: 'hi', href: url },
      { lang: 'x-default', href: url },
    ] : [];
    const xhtml = hreflang
      .map((h) => `    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${h.href}" />`)
      .join('\n');
    return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${xhtml ? `\n${xhtml}` : ''}\n  </url>`;
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${xmlItems.join('\n')}\n</urlset>\n`;
}

const outputDir = path.resolve(__dirname, '..', 'public');
const outputPath = path.join(outputDir, 'sitemap.xml');

if (SKIP) {
  console.log('SITEMAP_SKIP=1 set; skipping sitemap.xml generation to preserve manual edits.');
  process.exit(0);
}

try {
  const sitemap = await buildSitemap();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, sitemap, 'utf8');
  console.log(`sitemap.xml updated with ${sitemap.split('<url>').length - 1} routes (${outputPath})`);
} catch (err) {
  console.error('Failed to write sitemap.xml:', err?.message || err);
  process.exitCode = 1;
}
