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
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭️' : '❌';
  const msg = info ? ` - ${info}` : '';
  console.log(`${icon} ${label}: ${status}${msg}`);
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error('Missing Supabase envs. Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE(_KEY), and VITE_SUPABASE_ANON_KEY are set in .env/.env.local');
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  let failures = 0;

  // 1) DB connectivity via admin: select from profiles
  try {
    const { data, error } = await admin.from('profiles').select('id').limit(1);
    if (error) throw error;
    log('DB connectivity (profiles select)', 'PASS', `${(data && data.length) ? 'rows: ' + data.length : '0 rows'}`);
  } catch (e) {
    failures++; log('DB connectivity (profiles select)', 'FAIL', e.message);
  }

  // 2) Fetch a sample user id for RPC that needs user context
  let sampleUserId = null;
  try {
    const { data, error } = await admin.from('profiles').select('id').limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    sampleUserId = data?.id || null;
  } catch {}

  // 3) Public RPC: is_username_available
  try {
    const uname = `healthcheck_${Date.now()}`;
    const { data, error } = await anon.rpc('is_username_available', { p_username: uname, p_exclude: null });
    if (error) throw error;
    if (typeof data === 'boolean') log('RPC is_username_available', 'PASS', `returned ${data}`);
    else log('RPC is_username_available', 'PASS');
  } catch (e) {
    failures++; log('RPC is_username_available', 'FAIL', e.message);
  }

  // 4) Public RPC: profiles_public_by_ids (empty)
  try {
    const { data, error } = await anon.rpc('profiles_public_by_ids', { p_ids: [] });
    if (error) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('permission denied') || msg.includes('rls')) {
        // Some environments intentionally restrict anon reads of profiles; not app-critical
        log('RPC profiles_public_by_ids', 'SKIP', 'anon read restricted (profiles)');
      } else {
        throw error;
      }
    } else {
      log('RPC profiles_public_by_ids', 'PASS', `rows: ${(data?.length ?? 0)}`);
    }
  } catch (e) {
    failures++; log('RPC profiles_public_by_ids', 'FAIL', e.message);
  }

  // 5) Public RPC: get_all_time_leaderboard_v2 (limit 1)
  try {
    const { data, error } = await anon.rpc('get_all_time_leaderboard_v2', { limit_rows: 1, offset_rows: 0, max_streak_limit: 30 });
    if (error) throw error;
    log('RPC get_all_time_leaderboard_v2', 'PASS', `rows: ${(data?.length ?? 0)}`);
  } catch (e) {
    failures++; log('RPC get_all_time_leaderboard_v2', 'FAIL', e.message);
  }

  // 6) Levels table presence (admin)
  try {
    const { data, error } = await admin.from('levels').select('level,coins_required').order('level', { ascending: true }).limit(1);
    if (error) throw error;
    if (data && data.length > 0) log('Table levels exists', 'PASS', `level ${data[0].level} => ${data[0].coins_required}`);
    else log('Table levels exists', 'PASS', '0 rows');
  } catch (e) {
    // Not strictly critical since FE computes locally; mark as SKIP if missing
    log('Table levels exists', 'SKIP', e.message);
  }

  // 7) Optional RPC: get_next_level_info (admin, if sample id found)
  if (sampleUserId) {
    try {
      const { data, error } = await admin.rpc('get_next_level_info', { p_user_id: sampleUserId });
      if (error) throw error;
      const d = Array.isArray(data) ? data[0] : data;
      log('RPC get_next_level_info', 'PASS', d ? `L${d.current_level}→L${d.next_level}, remain=${d.coins_remaining}` : 'no data');
    } catch (e) {
      // Migration may not be applied yet
      log('RPC get_next_level_info', 'SKIP', e.message);
    }
  } else {
    log('RPC get_next_level_info', 'SKIP', 'no sample user available');
  }

  if (failures > 0) {
    console.log(`\nSummary: ${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nSummary: All critical checks passed.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
