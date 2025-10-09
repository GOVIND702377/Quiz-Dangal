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

const main = async () => {
  const { data, error } = await supabase.rpc('admin_bulk_upsert_questions', {
    p_quiz_id: '00000000-0000-0000-0000-000000000000',
    p_payload: [],
    p_mode: 'append',
  });
  console.log('RPC response:', { data, error });
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
