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

  // 1) Settings row
  try {
    const { data, error } = await sb.from('ai_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (!data) {
      log('automation settings (ai_settings)', 'FAIL', 'missing. Apply migrations supabase/migrations/*ai_quiz_automation.sql');
    } else {
      const cats = Array.isArray(data.categories) ? data.categories.join(',') : String(data.categories);
      log('automation settings', data.is_enabled ? 'PASS' : 'WARN', `enabled=${data.is_enabled}, cadence=${data.cadence_min}m, live=${data.live_window_min}m, cats=[${cats}]`);
      if (Number(data.live_window_min) > Number(data.cadence_min)) {
        log('schedule sanity', 'WARN', 'live_window_min > cadence_min (quizzes may overlap or be skipped)');
      }
    }
  } catch (e) {
    log('automation settings', 'FAIL', e.message);
  }

  // 2) Providers (non-AI)
  try {
    const { data, error } = await sb
      .from('ai_providers')
      .select('id,name,enabled,priority,quota_exhausted,last_error,last_error_at')
      .order('priority', { ascending: true });
    if (error) throw error;
    const enabled = (data || []).filter(p => p.enabled && !p.quota_exhausted);
    if (!enabled.length) log('providers', 'WARN', 'No enabled providers');
    else log('providers', 'PASS', enabled.map(p => `${p.name}#${p.id}(p${p.priority})`).join(', '));
    const errs = (data || []).filter(p => p.last_error);
    if (errs.length) {
      console.log('\nProvider last_error:');
      for (const p of errs) {
        console.log(`- ${p.name}#${p.id}: ${p.last_error} @ ${p.last_error_at || '-'}`);
      }
    }
  } catch (e) {
    log('providers', 'FAIL', e.message);
  }

  // 3) Recent jobs
  try {
    const { data, error } = await sb.from('ai_generation_jobs')
      .select('id,category,slot_start,slot_end,status,provider_name,quiz_id,error,created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      log('jobs', 'WARN', 'No recent jobs found');
    } else {
      console.log('\nRecent jobs:');
      for (const j of data) {
        console.log(`- #${j.id} [${j.status}] ${j.category} @ ${j.slot_start} -> quiz=${j.quiz_id || '-'} provider=${j.provider_name || '-'} ${j.error ? 'err=' + j.error : ''}`);
      }
      console.log('');
      const failed = data.filter(j => j.status === 'failed');
      if (failed.length) log('jobs failed', 'WARN', `${failed.length} failures (see ai_generation_logs)`);
      else log('jobs', 'PASS', 'No recent failures');
    }
  } catch (e) {
    log('jobs', 'FAIL', e.message);
  }

  // 4) Recent logs
  try {
    const { data, error } = await sb.from('ai_generation_logs')
      .select('created_at,level,message')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    console.log('\nRecent logs:');
    for (const r of data || []) {
      console.log(`- ${r.created_at} [${r.level}] ${r.message}`);
    }
  } catch (e) {
    log('logs', 'FAIL', e.message);
  }

  // 4b) Errors/Warns in last 24h
  try {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('ai_generation_logs')
      .select('created_at,level,message')
      .gte('created_at', since24)
      .in('level', ['warn','error'])
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    if (data?.length) {
      console.log('\nWarn/Error logs (24h):');
      for (const r of data) console.log(`- ${r.created_at} [${r.level}] ${r.message}`);
    } else {
      log('warn/error logs (24h)', 'PASS', 'none');
    }
  } catch (e) {
    log('warn/error logs (24h)', 'FAIL', e.message);
  }

  // 4c) Failed jobs in last 24h
  try {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('ai_generation_jobs')
      .select('id,category,slot_start,status,error,created_at')
      .eq('status', 'failed')
      .gte('created_at', since24)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (data?.length) {
      console.log('\nFailed jobs (24h):');
      for (const j of data) console.log(`- #${j.id} ${j.category} @ ${j.slot_start} -> ${j.error || 'no error'}`);
    } else {
      log('failed jobs (24h)', 'PASS', 'none');
    }
  } catch (e) {
    log('failed jobs (24h)', 'FAIL', e.message);
  }

  // 5) Quizzes created in last 2h
  try {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('quizzes')
      .select('id,title,category,is_ai_generated,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    const all = data || [];
    const ai = all.filter(q => q.is_ai_generated);
    log('quizzes (2h)', all.length ? 'PASS' : 'WARN', `${all.length} total, ${ai.length} auto-flagged`);
    for (const q of all) {
      console.log(`- ${q.created_at} [${q.is_ai_generated ? 'auto' : 'manual'}] ${q.category} ${q.title} (${q.id})`);
    }
  } catch (e) {
    log('quizzes (2h)', 'FAIL', e.message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
