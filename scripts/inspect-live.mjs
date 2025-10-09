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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
    return env;
  } catch { return {}; }
}

function loadEnv() {
  const envLocal = parseEnvFile(path.join(ROOT, '.env.local'));
  const envRoot = parseEnvFile(path.join(ROOT, '.env'));
  return { ...envRoot, ...envLocal, ...process.env };
}

function log(section, obj) {
  console.log(`\n=== ${section} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL and/or service role key in .env/.env.local');
    process.exit(2);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const tables = [
    'profiles','quizzes','questions','options','quiz_participants','user_answers','quiz_results',
    'transactions','referrals','notifications','push_subscriptions','redemptions','levels','reward_catalog'
  ];

  const out = { ts: new Date().toISOString(), tables: {} };

  for (const t of tables) {
    try {
      const { data, error, count } = await admin
        .from(t)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      // fetch 1 row for sample columns
      const { data: one } = await admin.from(t).select('*').limit(1);
      const sample = Array.isArray(one) && one[0] ? Object.keys(one[0]) : [];
      out.tables[t] = { count: count ?? 0, sampleColumns: sample };
    } catch (e) {
      out.tables[t] = { error: e?.message || String(e) };
    }
  }

  // RPC sanity
  const rpcs = {
    is_username_available: async (c) => c.rpc('is_username_available', { p_username: `probe_${Date.now()}`, p_exclude: null }),
    get_all_time_leaderboard_v2: async (c) => c.rpc('get_all_time_leaderboard_v2', { limit_rows: 1, offset_rows: 0, max_streak_limit: 30 }),
  };
  out.rpcs = {};
  for (const [name, fn] of Object.entries(rpcs)) {
    try { const { error } = await fn(admin); if (error) throw error; out.rpcs[name] = 'OK'; }
    catch (e) { out.rpcs[name] = `ERR: ${e?.message || e}`; }
  }

  log('LIVE INSPECTION', out);
}

main().catch((e) => { console.error(e); process.exit(1); });
