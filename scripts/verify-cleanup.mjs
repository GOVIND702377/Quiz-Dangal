#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const env = {};
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
      if (!m) return;
      const key = m[1].trim();
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith('\'') && val.endsWith('\'')) val = val.slice(1, -1);
      env[key] = val;
    });
    return env;
  } catch {
    return {};
  }
}

function loadEnv() {
  const envLocal = parseEnvFile(path.join(ROOT, '.env.local'));
  const envRoot = parseEnvFile(path.join(ROOT, '.env'));
  return { ...envRoot, ...envLocal, ...process.env };
}

function log(label, status, info = '') {
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : status === 'INFO' ? 'ℹ️' : '❌';
  const msg = info ? ` - ${info}` : '';
  console.log(`${icon} ${label}: ${status}${msg}`);
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.error('Missing Supabase envs. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
    process.exit(2);
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Read cleanup_days
  const { data: settings, error: sErr } = await sb.from('ai_settings').select('cleanup_days').eq('id', 1).maybeSingle();
  if (sErr) throw sErr;
  const cleanupDays = Number(settings?.cleanup_days ?? 3);
  log('cleanup_days', 'INFO', String(cleanupDays));

  const cutoff = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000).toISOString();

  // 2) Count AI quizzes older than cutoff
  const { data: cntRows, error: cErr } = await sb
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('is_ai_generated', true)
    .lte('end_time', cutoff);
  if (cErr) throw cErr;
  const olderCount = cntRows?.length ?? (typeof cntRows === 'number' ? cntRows : 0);
  log('ai_quizzes_older_than_cutoff', olderCount === 0 ? 'PASS' : 'WARN', String(olderCount));

  // 3) Show last 5 cleanup logs
  const { data: logs, error: lErr } = await sb
    .from('ai_generation_logs')
    .select('created_at,level,message,context')
    .in('message', ['cleanup done', 'cleanup skip (none)'])
    .order('created_at', { ascending: false })
    .limit(5);
  if (lErr) throw lErr;
  console.log('\nRecent cleanup logs:');
  for (const r of logs || []) {
    console.log(`- ${r.created_at} [${r.level}] ${r.message} ${r.context ? JSON.stringify(r.context) : ''}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
