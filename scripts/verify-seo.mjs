#!/usr/bin/env node
/**
 * SEO Verification Script for Quiz Dangal
 * Checks common SEO issues before deployment
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const errors = [];
const warnings = [];
const success = [];

console.log('🔍 Running SEO verification checks...\n');
// Check 1: Sitemap exists and is valid
try {
  const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    errors.push('❌ sitemap.xml not found in public/');
  } else {
    const sitemap = readFileSync(sitemapPath, 'utf-8');
    // Extract all <loc> entries and ensure they belong to quizdangal.com
    const locs = Array.from(sitemap.matchAll(/<loc>\s*([^<\s][^<]*)\s*<\/loc>/g)).map(m => m[1]);
    if (locs.length === 0) {
      errors.push('❌ sitemap.xml appears to have no <loc> entries');
    } else {
      const badHosts = [];
      for (const raw of locs) {
        try {
          const u = new URL(raw.trim());
          const hostOk = /(^|\.)quizdangal\.com$/i.test(u.hostname);
          if (!hostOk) badHosts.push(u.hostname);
        } catch {
          badHosts.push('(invalid-url)');
        }
      }
      if (badHosts.length > 0) {
        errors.push(`❌ sitemap.xml contains non-quizdangal URLs (e.g., ${badHosts[0]})`);
      } else {
        // Parse <lastmod> values and warn only if any is truly in the future
        try {
          const rx = /<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g;
          const now = new Date();
          const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
          let m;
          let futureCount = 0;
          while ((m = rx.exec(sitemap)) !== null) {
            const dateStr = m[1];
            const t = Date.parse(dateStr + 'T00:00:00Z');
            if (Number.isFinite(t) && t > todayUTC) {
              futureCount++;
            }
          }
          if (futureCount > 0) {
            warnings.push(`⚠️  sitemap.xml has ${futureCount} future lastmod date(s)`);
          } else {
            success.push('✅ sitemap.xml is valid');
          }
        } catch (e) {
          // If parse fails, do not block; just provide a soft warning
          warnings.push('⚠️  Unable to fully parse lastmod dates from sitemap.xml');
        }
      }
    }
  }
} catch (err) {
  errors.push(`❌ Error reading sitemap.xml: ${err.message}`);
}

// Check 2: Robots.txt exists
try {
  const robotsPath = join(process.cwd(), 'public', 'robots.txt');
  if (!existsSync(robotsPath)) {
    errors.push('❌ robots.txt not found in public/');
  } else {
    const robots = readFileSync(robotsPath, 'utf-8');
    if (!robots.includes('Sitemap:')) {
      warnings.push('⚠️  robots.txt missing Sitemap directive');
    } else {
      success.push('✅ robots.txt is valid');
    }
  }
} catch (err) {
  errors.push(`❌ Error reading robots.txt: ${err.message}`);
}

// Check 3: Index.html has proper meta tags
try {
  const indexPath = join(process.cwd(), 'index.html');
  if (!existsSync(indexPath)) {
    errors.push('❌ index.html not found');
  } else {
    const index = readFileSync(indexPath, 'utf-8');
    // Check for essential meta tags
    if (!index.includes('<meta name="description"')) {
      warnings.push('⚠️  index.html missing meta description');
    }
    if (!index.includes('og:title')) {
      warnings.push('⚠️  index.html missing Open Graph tags');
    }
    if (!index.includes('application/ld+json')) {
      warnings.push('⚠️  index.html missing structured data');
    }
    if (!index.includes('<h1')) {
      warnings.push('⚠️  index.html missing H1 tag in noscript');
    }
    if (warnings.length === 0) {
      success.push('✅ index.html has proper meta tags');
    }
  }
} catch (err) {
  errors.push(`❌ Error reading index.html: ${err.message}`);
}

// Check 4: Key pages have SEO component
const keyPages = [
  'src/pages/PlayWinQuiz.jsx',
  'src/pages/OpinionQuiz.jsx',
  'src/pages/ReferEarnInfo.jsx',
  'src/pages/AboutUs.jsx',
  'src/pages/ContactUs.jsx',
  'src/pages/TermsConditions.jsx',
  'src/pages/PrivacyPolicy.jsx',
  'src/pages/Leaderboards.jsx'
];

keyPages.forEach(page => {
  try {
    const pagePath = join(process.cwd(), page);
    if (!existsSync(pagePath)) {
      warnings.push(`⚠️  ${page} not found`);
    } else {
      const content = readFileSync(pagePath, 'utf-8');
      if (!content.includes('from \'@/components/SEO\'') && !content.includes('from "@/components/SEO"')) {
        warnings.push(`⚠️  ${page} missing SEO component import`);
      } else if (!content.includes('<SEO')) {
        warnings.push(`⚠️  ${page} not using SEO component`);
      }
    }
  } catch (err) {
    warnings.push(`⚠️  Error checking ${page}: ${err.message}`);
  }
});

if (keyPages.length === 9) {
  success.push('✅ All key pages checked for SEO component');
}

// Print results
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (success.length > 0) {
  console.log('✅ SUCCESS:\n');
  success.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  warnings.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ ERRORS:\n');
  errors.forEach(msg => console.log(`  ${msg}`));
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (errors.length > 0) {
  console.log('❌ SEO verification failed. Please fix errors before deploying.\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('⚠️  SEO verification passed with warnings. Consider fixing them.\n');
  process.exit(0);
} else {
  console.log('✅ All SEO checks passed! Ready to deploy.\n');
  process.exit(0);
}

