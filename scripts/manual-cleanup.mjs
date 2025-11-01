#!/usr/bin/env node
// Dev-only fallback cleaner for 3+ day old AI quizzes
// Preferred path: trigger Edge Function cleanup via scripts/trigger-ai.ps1 with CRON_SECRET
// This script requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and runs chunked deletes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s || s.startsWith('#')) return;
      const eq = s.indexOf('='); if (eq === -1) return;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    });
  } catch {}
}

loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function chunkedDelete(table, column, ids, batch = 200) {
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    const { error } = await supabase.from(table).delete().in(column, slice);
    if (error) throw error;
  }
}

function iso(d) { return new Date(d).toISOString(); }

try {
  console.log('[cleanup] starting...');
  const { data: settings, error: sErr } = await supabase.from('ai_settings').select('cleanup_days').eq('id', 1).maybeSingle();
  if (sErr) throw sErr;
  const days = Number(settings?.cleanup_days ?? 3);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Collect AI quiz IDs to delete
  const { data: quizzes, error: qErr } = await supabase
    .from('quizzes')
    .select('id')
    .eq('is_ai_generated', true)
    .lte('end_time', iso(cutoff))
    .limit(2000);
  if (qErr) throw qErr;

  const ids = (quizzes || []).map(r => r.id);
  console.log('[cleanup] found quizzes:', ids.length);
  if (ids.length === 0) {
    console.log(JSON.stringify({ ok: true, cutoff: cutoff.toISOString(), count: 0 }, null, 2));
    process.exit(0);
  }

  // Collect question ids
  const { data: qs, error: qsErr } = await supabase.from('questions').select('id').in('quiz_id', ids).limit(100000);
  if (qsErr) throw qsErr;
  const qids = (qs || []).map(x => x.id);

  // Delete in FK-safe order
  // Prefer cascading via FK from quizzes if available to avoid edit-lock triggers on questions/options
  console.log('[cleanup] deleting participants/results for', ids.length, 'quizzes');
  await chunkedDelete('quiz_participants', 'quiz_id', ids, 200);
  await chunkedDelete('quiz_results', 'quiz_id', ids, 200);

  console.log('[cleanup] deleting quizzes (cascade) for', ids.length, 'quizzes');
  await chunkedDelete('quizzes', 'id', ids, 200);

  await supabase.from('ai_generation_logs').insert({ level: 'info', message: 'cleanup done (manual script)', context: { cutoff: cutoff.toISOString(), count: ids.length } });

  console.log(JSON.stringify({ ok: true, cutoff: cutoff.toISOString(), count: ids.length }, null, 2));
} catch (e) {
  console.error('Cleanup error:', e?.message || String(e));
  if (e?.stack) console.error(e.stack);
  process.exitCode = 1;
}
