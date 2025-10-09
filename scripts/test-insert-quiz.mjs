import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!m) return;
      const [, key, rawVal] = m;
      if (process.env[key]) return;
      let val = rawVal.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  } catch (err) {}
}

loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const payload = {
  title: `Debug Quiz ${new Date().toISOString()}`,
  prize_pool: 123,
  prizes: [100, 20, 3],
  start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  status: 'upcoming',
  category: 'gk',
  prize_type: 'money',
};

try {
  const { data, error } = await supabase.from('quizzes').insert([payload]).select('id');
  console.log('Insert response:', { data, error });
  if (data && data.length) {
    await supabase.from('quizzes').delete().eq('id', data[0].id);
    console.log('Cleanup: quiz deleted');
  }
} catch (err) {
  console.error('Insert threw exception:', err.message);
}
