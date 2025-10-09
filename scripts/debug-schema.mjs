import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  } catch (err) {
    // ignore
  }
}

loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing, cannot inspect schema');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = ['quizzes', 'quiz_prizes', 'questions', 'quiz_participants'];

try {
  await client.connect();
  for (const table of tables) {
    const { rows } = await client.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema='public' and table_name=$1
       order by ordinal_position`,
      [table]
    );
    console.log(`\nTable ${table}:`);
    if (rows.length === 0) {
      console.log('  (not found)');
    } else {
      for (const row of rows) {
        console.log(`  ${row.column_name} :: ${row.data_type}`);
      }
    }
  }

  const { rows: constraintRows } = await client.query(
    `select
        t.relname as table_name,
        c.conname,
        pg_get_constraintdef(c.oid) as definition
     from pg_constraint c
     join pg_class t on c.conrelid = t.oid
     join pg_namespace n on t.relnamespace = n.oid
     where n.nspname = 'public'
       and t.relname = any($1::text[])
     order by t.relname, c.conname`,
    [tables]
  );
  if (constraintRows.length) {
    console.log('\nConstraints:');
    for (const row of constraintRows) {
      console.log(`  ${row.table_name}.${row.conname} => ${row.definition}`);
    }
  }

  const { rows: policyRows } = await client.query(
    `select
        pol.tablename as table_name,
        pol.policyname,
        pol.cmd,
  pol.roles,
  pol.permissive,
  pol.qual,
  pol.with_check
     from pg_policies pol
     join pg_class cls on cls.relname = pol.tablename
     join pg_namespace n on n.oid = cls.relnamespace and n.nspname = pol.schemaname
     where pol.schemaname = 'public'
       and pol.tablename = any($1::text[])
     order by pol.tablename, pol.policyname`,
    [tables]
  );
  if (policyRows.length) {
    console.log('\nPolicies:');
    for (const row of policyRows) {
  const roles = Array.isArray(row.roles) ? row.roles.join(', ') : '∅';
  const usingClause = row.qual || 'true';
  const checkClause = row.with_check || 'true';
  console.log(`  ${row.table_name}.${row.policyname} [${row.cmd}] roles=${roles} permissive=${row.permissive} USING=${usingClause} CHECK=${checkClause}`);
    }
  }

  const functions = ['admin_bulk_upsert_questions', 'join_quiz', 'handle_referral_bonus'];
  const { rows: fnRows } = await client.query(
    `select routine_name, specific_schema
     from information_schema.routines
     where specific_schema='public' and routine_name = any($1::text[])`,
    [functions]
  );
  console.log('\nFunctions found:', fnRows);

  const { rows: fnDefs } = await client.query(
    `select p.proname as routine_name, pg_get_functiondef(p.oid) as definition
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any($1::text[])`,
    [functions]
  );
  if (fnDefs.length) {
    console.log('\nFunction definitions (truncated):');
    for (const row of fnDefs) {
      const snippet = row.definition.split('\n').slice(0, 10).join('\n');
      console.log(`--- ${row.routine_name} ---\n${snippet}\n...`);
    }
  }

  const { rows: roleCounts } = await client.query(
    `select role, count(*)::int as users
     from public.profiles
     group by role
     order by role`
  );
  console.log('\nProfiles by role:', roleCounts);
} catch (err) {
  console.error('Schema check failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
