#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
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

const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_CATALOG_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

(async () => {
  try {
    if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD || !TEST_CATALOG_ID) {
      console.error('Please set TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_CATALOG_ID in .env.local');
      process.exit(1);
    }
    const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });
    if (signErr) throw signErr;

    const { data, error } = await supabase.rpc('redeem_from_catalog', { p_catalog_id: TEST_CATALOG_ID });
    if (error) throw error;

    console.log('Redeem OK:', data);
  } catch (e) {
    console.error('Redeem failed:', e.message || e);
    process.exitCode = 1;
  }
})();
