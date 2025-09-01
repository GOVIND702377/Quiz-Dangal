// Verify anon (browser) access to public views used by the app
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : path.join(repoRoot, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  const views = ['all_time_leaderboard', 'leaderboard_weekly', 'leaderboard_monthly'];
  for (const v of views) {
    const { data, error } = await sb.from(v).select('*').limit(3);
    if (error) {
      console.error(`${v}: ERROR ${error.message}`);
    } else {
      console.log(`${v}: OK (${data.length} rows)`);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });