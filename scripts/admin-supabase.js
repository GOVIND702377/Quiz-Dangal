// Admin CLI for Supabase (read/write with service role)
// Usage examples:
//   node scripts/admin-supabase.js check
//   node scripts/admin-supabase.js read profiles --limit 5
//   node scripts/admin-supabase.js insert quiz_schedule --data '{"title":"Demo","start_time":"2025-09-01T10:00:00Z","end_time":"2025-09-01T11:00:00Z"}'
//   node scripts/admin-supabase.js update profiles --match '{"id":"<uuid>"}' --patch '{"role":"admin"}'
//   node scripts/admin-supabase.js delete quiz_participants --match '{"quiz_id":"<uuid>","user_id":"<uuid>"}'

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env (.env.local preferred)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');
const envPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : path.join(repoRoot, '.env');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function ok(msg) {
  console.log(msg);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      if (v !== undefined) {
        out[k] = v;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          out[k] = next;
          i++;
        } else {
          out[k] = true;
        }
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function getClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail(
      `Missing Supabase config. Please set in .env.local (preferred) or .env:\n` +
        `  SUPABASE_URL=...\n  SUPABASE_SERVICE_ROLE=...\n\n` +
        `NOTE: Never expose the service role key to the browser or commit it to git.`
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'quiz-dangal-admin-cli' } },
  });
}

async function cmdCheck() {
  const sb = getClient();
  // Try a lightweight head count query against a known table
  try {
    const { count, error } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    if (error) throw error;
    ok(`Connection OK. profiles count (approx): ${count ?? 'unknown'}`);
  } catch (e) {
    ok('Connection established. Attempting fallback check on quiz_schedule...');
    const { count, error } = await sb.from('quiz_schedule').select('*', { count: 'exact', head: true });
    if (error) fail(`Connection failed: ${error.message}`);
    ok(`Connection OK. quiz_schedule count (approx): ${count ?? 'unknown'}`);
  }
}

async function cmdRead(table, opts) {
  if (!table) fail('Usage: read <table> [--limit N] [--select cols] [--order col] [--desc]');
  const sb = getClient();
  const limit = opts.limit ? Number(opts.limit) : 10;
  let q = sb.from(table).select(opts.select || '*').limit(limit);
  if (opts.order) q = q.order(opts.order, { ascending: !opts.desc });
  const { data, error } = await q;
  if (error) fail(error.message);
  ok(JSON.stringify(data, null, 2));
}

function parseJsonMaybe(str, flagName) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    fail(`Invalid JSON for --${flagName}: ${e.message}`);
  }
}

async function cmdInsert(table, opts) {
  if (!table) fail('Usage: insert <table> --data "{...json...}"');
  const payload = parseJsonMaybe(opts.data, 'data');
  if (!payload) fail('Missing --data JSON');
  const sb = getClient();
  const { data, error } = await sb.from(table).insert(payload).select();
  if (error) fail(error.message);
  ok(JSON.stringify(data, null, 2));
}

async function cmdUpdate(table, opts) {
  if (!table) fail('Usage: update <table> --match "{...json...}" --patch "{...json...}"');
  const match = parseJsonMaybe(opts.match, 'match');
  const patch = parseJsonMaybe(opts.patch, 'patch');
  if (!match || !patch) fail('Both --match and --patch JSON are required');
  const sb = getClient();
  const { data, error } = await sb.from(table).update(patch).match(match).select();
  if (error) fail(error.message);
  ok(JSON.stringify(data, null, 2));
}

async function cmdDelete(table, opts) {
  if (!table) fail('Usage: delete <table> --match "{...json...}"');
  const match = parseJsonMaybe(opts.match, 'match');
  if (!match) fail('Missing --match JSON');
  const sb = getClient();
  const { data, error } = await sb.from(table).delete().match(match).select();
  if (error) fail(error.message);
  ok(JSON.stringify(data, null, 2));
}

function help() {
  const msg = `Supabase Admin CLI (service role)

Commands:
  check                         Test connection and basic access
  read <table> [--limit N]      Read rows from a table
       [--select cols] [--order col] [--desc]
  insert <table> --data JSON    Insert a row/object (or array of objects)
  update <table> --match JSON   Update rows matching filter with patch
                   --patch JSON
  delete <table> --match JSON   Delete rows matching filter

Environment (in .env.local preferred):
  SUPABASE_URL=...                (or VITE_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE=...       DO NOT expose this to the browser or commit it
`;
  console.log(msg);
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const [cmd, table] = argv._;
  switch (cmd) {
    case 'check':
      await cmdCheck();
      break;
    case 'read':
      await cmdRead(table, argv);
      break;
    case 'insert':
      await cmdInsert(table, argv);
      break;
    case 'update':
      await cmdUpdate(table, argv);
      break;
    case 'delete':
      await cmdDelete(table, argv);
      break;
    default:
      help();
  }
}

main().catch((e) => fail(e.message));
