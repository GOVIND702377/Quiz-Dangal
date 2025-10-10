import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.SITEMAP_BASE_URL || 'https://quizdangal.com';

const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: 1.0 },
  { loc: '/leaderboards', changefreq: 'weekly', priority: 0.8 },
  { loc: '/play-win-quiz-app', changefreq: 'weekly', priority: 0.7 },
  { loc: '/opinion-quiz-app', changefreq: 'weekly', priority: 0.7 },
  { loc: '/refer-earn-quiz-app', changefreq: 'weekly', priority: 0.7 },
  { loc: '/about-us', changefreq: 'monthly', priority: 0.6 },
  { loc: '/contact-us', changefreq: 'monthly', priority: 0.6 },
  { loc: '/terms-conditions', changefreq: 'yearly', priority: 0.5 },
  { loc: '/privacy-policy', changefreq: 'yearly', priority: 0.5 },
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
  if (loc.startsWith('http://') || loc.startsWith('https://')) return loc;
  return `${HOST.replace(/\/$/, '')}${loc}`;
};

const xmlItems = STATIC_ROUTES.map((route) => `  <url>\n    <loc>${toUrl(route.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlItems}\n</urlset>\n`;

const outputPath = path.resolve(__dirname, '..', 'public', 'sitemap.xml');

await fs.writeFile(outputPath, sitemap, 'utf8');

console.log(`sitemap.xml updated with ${STATIC_ROUTES.length} routes (${outputPath})`);
