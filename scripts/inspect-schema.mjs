#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnvFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    let raw;
    if (buf[0] === 0xff && buf[1] === 0xfe) {
      raw = buf.toString('utf16le');
    } else if (buf[0] === 0xfe && buf[1] === 0xff) {
      raw = buf.slice(2).toString('utf16le');
    } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      raw = buf.slice(3).toString('utf8');
    } else {
      raw = buf.toString('utf8');
    }
    raw.split(/\r?\n/).forEach((line) => {
      const cleaned = line.replace(/^\uFEFF/, '').trim();
      if (!cleaned || cleaned.startsWith('#')) return;
      const eq = cleaned.indexOf('=');
      if (eq === -1) return;
      const key = cleaned.slice(0, eq).trim();
      let val = cleaned.slice(eq + 1).trim();
      // strip inline comments if unquoted
      if (!(val.startsWith('"') || val.startsWith('\''))) {
        const hash = val.indexOf('#');
        if (hash !== -1) val = val.slice(0, hash).trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {}
}

function loadEnv() {
  const env = {};
  const files = [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '.env.local')];
  for (const f of files) {
    try {
      const buf = fs.readFileSync(f);
      let raw;
      if (buf[0] === 0xff && buf[1] === 0xfe) raw = buf.toString('utf16le');
      else if (buf[0] === 0xfe && buf[1] === 0xff) raw = buf.slice(2).toString('utf16le');
      else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) raw = buf.slice(3).toString('utf8');
      else raw = buf.toString('utf8');
      raw.split(/\r?\n/).forEach((line) => {
        const cleaned = line.replace(/^\uFEFF/, '').trim();
        if (!cleaned || cleaned.startsWith('#')) return;
        const eq = cleaned.indexOf('='); if (eq === -1) return;
        const key = cleaned.slice(0, eq).trim();
        let val = cleaned.slice(eq + 1).trim();
        if (!(val.startsWith('"') || val.startsWith('\''))) {
          const hash = val.indexOf('#'); if (hash !== -1) val = val.slice(0, hash).trim();
        }
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) val = val.slice(1, -1);
        env[key] = val;
      });
    } catch {}
  }
  // finally, bring in process.env only for keys not defined in files
  for (const [k, v] of Object.entries(process.env)) {
    if (!(k in env)) env[k] = v;
  }
  return env;
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;
console.error('Debug: env has keys:', Object.keys(env).filter(k => /DATABASE|SUPABASE|VITE/.test(k)));
console.error('Debug: DATABASE_URL value preview:', (DATABASE_URL||'').slice(0, 40));
if (!DATABASE_URL) {
  console.error(`Debug: DATABASE_URL not found after loading env files. Checked: .env.local exists=${fs.existsSync(path.join(__dirname, '..', '.env.local'))}`);
}

let FINAL_DB_URL = DATABASE_URL;
if (!FINAL_DB_URL) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*(.+)$/mi);
    if (m) {
      FINAL_DB_URL = m[1].trim();
      console.error('Debug: Fallback regex picked up DATABASE_URL');
    }
  } catch {}
}

if (!FINAL_DB_URL) {
  console.error('DATABASE_URL missing. Please set it in .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString: FINAL_DB_URL, ssl: { rejectUnauthorized: false } });

function printSection(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(rows, null, 2));
}

await client.connect();
try {
  const schema = 'public';

  const tables = await client.query(
    `select c.oid as oid, c.relname as table_name
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relkind in ('r','p','v','m')
     order by c.relkind, c.relname`,
    [schema]
  );
  printSection('Tables/Views/Materialized', tables.rows);

  const columns = await client.query(
    `select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = $1
     order by table_name, ordinal_position`,
    [schema]
  );
  printSection('Columns', columns.rows);

  const pks = await client.query(
    `select
       t.relname as table_name,
       i.relname as index_name,
       a.attname as column_name
     from pg_index x
     join pg_class t on t.oid = x.indrelid
     join pg_class i on i.oid = x.indexrelid
     join pg_namespace n on n.oid = t.relnamespace and n.nspname = $1
     join unnest(x.indkey) with ordinality as k(attnum, ord) on true
     join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where x.indisprimary
     order by t.relname, ord`,
    [schema]
  );
  printSection('Primary Keys', pks.rows);

  const fks = await client.query(
    `select
       tc.table_name,
       kcu.column_name,
       ccu.table_name as foreign_table_name,
       ccu.column_name as foreign_column_name,
       rc.update_rule, rc.delete_rule
     from information_schema.table_constraints as tc
     join information_schema.key_column_usage as kcu
       on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
     join information_schema.constraint_column_usage as ccu
       on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
     join information_schema.referential_constraints as rc
       on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = $1
     order by tc.table_name, kcu.ordinal_position`,
    [schema]
  );
  printSection('Foreign Keys', fks.rows);

  const indexes = await client.query(
    `select t.relname as table_name, i.relname as index_name, pg_get_indexdef(i.oid) as definition
     from pg_class t
     join pg_index x on x.indrelid = t.oid
     join pg_class i on i.oid = x.indexrelid
     join pg_namespace n on n.oid = t.relnamespace and n.nspname = $1
     order by t.relname, i.relname`,
    [schema]
  );
  printSection('Indexes', indexes.rows);

  const policies = await client.query(
    `select
       pol.schemaname,
       pol.tablename,
       pol.policyname,
       pol.cmd,
       pol.roles,
       pol.permissive,
       pol.qual,
       pol.with_check
     from pg_policies pol
     join pg_class cls on cls.relname = pol.tablename
     join pg_namespace n on n.oid = cls.relnamespace and n.nspname = pol.schemaname
     where pol.schemaname = $1
     order by pol.tablename, pol.policyname`,
    [schema]
  );
  printSection('RLS Policies', policies.rows);

  const triggers = await client.query(
    `select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
     from information_schema.triggers
     where trigger_schema = $1
     order by event_object_table, trigger_name`,
    [schema]
  );
  printSection('Triggers', triggers.rows);

  const functions = await client.query(
    `select p.proname as routine_name, pg_get_function_identity_arguments(p.oid) as args, lanname as lang,
            p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace and n.nspname = $1
     join pg_language l on l.oid = p.prolang
     order by 1`,
    [schema]
  );
  // Print only names, args, lang, security for brevity; definitions can be long
  printSection('Functions (summary)', functions.rows.map(f => ({
    routine_name: f.routine_name,
    args: f.args,
    lang: f.lang,
    security_definer: f.security_definer,
    has_definition: !!f.definition
  })));

  console.log('\nDone.');
} catch (e) {
  console.error('Inspect error:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
