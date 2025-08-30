// Schema introspection via direct Postgres (Supabase) connection
// Requires: DATABASE_URL in .env.local (e.g., from Supabase Dashboard → Database → Connection string)
// Usage: node scripts/db-introspect.js [--json]

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// Relax TLS verification for Supabase-managed cert chain in local scripts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : path.join(repoRoot, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local (Supabase Postgres connection string).');
  console.error('Find it in Supabase Dashboard → Project Settings → Database → Connection string.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function q(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function main() {
  const jsonOut = process.argv.includes('--json');

  const tables = await q(`
    select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by 1,2;
  `);

  const columns = await q(`
    select table_schema as schema, table_name as table, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `);

  const triggers = await q(`
    select n.nspname as schema, c.relname as table, t.tgname as trigger_name,
           pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
    order by 1,2,3;
  `);

  const policies = await q(`
    select schemaname as schema, tablename as table, policyname, permissive,
           roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname;
  `);

  const functions = await q(`
    select n.nspname as schema, p.proname as function, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by 1,2;
  `);

  const extensions = await q(`
    select extname from pg_extension order by 1;
  `);

  const res = { tables, columns, triggers, policies, functions, extensions };
  if (jsonOut) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log('Tables (public):');
    tables.forEach((t) => console.log(`- ${t.table}  rls=${t.rls_enabled}`));
    console.log('\nPolicies:');
    policies.forEach((p) => console.log(`- ${p.table} :: ${p.policyname} [${p.cmd}]`));
    console.log('\nTriggers:');
    triggers.forEach((t) => console.log(`- ${t.table} :: ${t.trigger_name}`));
    console.log('\nFunctions:');
    functions.forEach((f) => console.log(`- ${f.function}`));
    console.log('\nExtensions:');
    extensions.forEach((e) => console.log(`- ${e.extname}`));
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('Introspection failed:', e.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
