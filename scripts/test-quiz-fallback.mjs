import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!m) return;
      if (process.env[m[1]]) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    });
  } catch {}
}

loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing envs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const buildPayload = (includePrizeType = true) => {
  const base = {
    title: 'Fallback test ' + new Date().toISOString(),
    prize_pool: 10,
    prizes: [10],
    start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  status: 'upcoming',
  category: 'gk',
  };
  if (includePrizeType) base.prize_type = 'money';
  return base;
};

const tryInsert = async (includePrizeType = true) => {
  const dataPayload = buildPayload(includePrizeType);
  return supabase.from('quizzes').insert([dataPayload]).select('id');
};

const main = async () => {
  let { data, error } = await tryInsert(true);
  console.log('first result', { data, error });
  if (error && /prize_type/.test(error.message || '')) {
    ({ data, error } = await tryInsert(false));
    console.log('second result', { data, error });
  }
  if (data && data.length) {
    await supabase.from('quizzes').delete().eq('id', data[0].id);
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
