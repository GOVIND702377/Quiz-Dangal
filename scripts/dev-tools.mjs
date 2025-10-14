#!/usr/bin/env node
/**
 * Dev DB/REST helper tools (consolidated):
 *  node scripts/dev-tools.mjs list-functions
 *  node scripts/dev-tools.mjs notify-reload
 *  node scripts/dev-tools.mjs test-redeem
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvPair(fileNames) {
  for (const name of fileNames) {
    const p = path.join(process.cwd(), name);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p,'utf8');
      const map = {};
      raw.split(/\r?\n/).forEach(l => {
        const eq = l.indexOf('=');
        if (eq > 0) {
          const key = l.slice(0, eq).trim();
          const val = l.slice(eq+1).trim();
          if (key) map[key] = val;
        }
      });
      return map;
    }
  }
  return {};
}

async function listFunctions() {
  const env = loadEnvPair(['.env.local']);
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing in .env.local');
  const client = new Client({ connectionString: url });
  await client.connect();
  const sql = `select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname='public' and p.proname like 'redeem_from_catalog%'
               order by 1,2`;
  const { rows } = await client.query(sql);
  console.table(rows);
  await client.end();
}

async function notifyReload() {
  const env = loadEnvPair(['.env.local']);
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing in .env.local');
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("NOTIFY pgrst, 'reload schema';");
  console.log('Sent NOTIFY reload schema');
  await c.end();
}

async function testRedeem() {
  const env = loadEnvPair(['.env','.env.local']);
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const ANON = env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) throw new Error('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env');
  const endpoint = SUPABASE_URL + '/rest/v1/rpc/redeem_from_catalog_with_details';
  const body = { p_catalog_id: null, p_payout_identifier: 'test@upi', p_payout_channel: 'upi' };
  const res = await fetch(endpoint, { method:'POST', headers:{ apikey:ANON, Authorization:'Bearer '+ANON, 'Content-Type':'application/json'}, body: JSON.stringify(body) });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
}

const cmd = process.argv[2];
(async () => {
  try {
    switch (cmd) {
      case 'list-functions': await listFunctions(); break;
      case 'notify-reload': await notifyReload(); break;
      case 'test-redeem': await testRedeem(); break;
      default:
        console.log('Usage: node scripts/dev-tools.mjs <list-functions|notify-reload|test-redeem>');
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
