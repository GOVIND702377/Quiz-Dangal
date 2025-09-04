import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Prefer .env.local
const envLocal = path.join(repoRoot, '.env.local');
const envPath = fs.existsSync(envLocal) ? envLocal : path.join(repoRoot, '.env');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or VITE_ equivalents) in .env.local');
  process.exit(1);
}

if (process.argv.length < 3) {
  console.error('Usage: node scripts/apply-sql.js <path-to-sql-file>');
  process.exit(1);
}

const sqlFile = process.argv[2];
const sqlPath = path.resolve(process.cwd(), sqlFile);
const sql = fs.readFileSync(sqlPath, 'utf8');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Executing SQL file: ${sqlPath}`);
const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
if (error) {
  console.error('Error executing SQL:', error);
  process.exit(1);
}
console.log('Success. Result:', data);
