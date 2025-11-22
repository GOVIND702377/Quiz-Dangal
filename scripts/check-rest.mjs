#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const i = trimmed.indexOf('='); if (i === -1) return;
      const k = trimmed.slice(0, i).trim();
      let v = trimmed.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    });
  } catch {}
}

parseEnvFile(path.join(__dirname, '..', '.env.local'));
parseEnvFile(path.join(__dirname, '..', '.env'));

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL) {
  console.error('Missing VITE_SUPABASE_URL/SUPABASE_URL in env');
  process.exit(1);
}

const endpoints = [
  `${URL}/rest/v1/quizzes?select=id,title&limit=1`,
  `${URL}/rest/v1/reward_catalog?select=id,reward_type&limit=1`,
];

async function hit(url, headers, label) {
  const res = await fetch(url, { headers });
  const text = await res.text().catch(() => '');
  const snippet = text.length > 180 ? text.slice(0, 180) + '…' : text;
  console.log(`[${label}] ${res.status} ${res.statusText} -> ${snippet}`);
  return res.status;
}

(async () => {
  console.log('Checking PostgREST endpoints:', endpoints.map(e => e.replace(URL, '<SUPABASE_URL>')));
  for (const ep of endpoints) {
    // 1) Anonymous (no Authorization) — expected 404 if not logged-in due to RLS
    await hit(ep, { apikey: ANON || '' }, 'anon-no-auth');

    // 2) Service role (bypass RLS) — expected 200 if table exists and PostgREST sees it
    if (SERVICE) {
      await hit(ep, { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }, 'service-role');
    } else {
      console.log('[service-role] SUPABASE_SERVICE_ROLE_KEY not set; skipping');
    }
  }
})();
