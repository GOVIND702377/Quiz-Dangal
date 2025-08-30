// Execute arbitrary SQL safely from a file or inline string
// Requires: DATABASE_URL in .env.local
// Usage:
//   node scripts/db-exec-sql.js --file scripts/2025-08-26-diagnostics.sql
//   node scripts/db-exec-sql.js --sql "select now();"

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// Relax TLS verification for Supabase in local scripts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : path.join(repoRoot, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const eqIdx = key.indexOf('=');
      if (eqIdx !== -1) {
        const k = key.slice(0, eqIdx);
        const v = key.slice(eqIdx + 1);
        out[k] = v;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          out[key] = next;
          i++;
        } else {
          out[key] = true;
        }
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sql = args.sql || (args.file ? fs.readFileSync(args.file, 'utf8') : null);
  if (!sql) {
    console.error('Provide --sql "..." or --file path.sql');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(sql);
      console.log(JSON.stringify({ rowCount: res.rowCount, rows: res.rows }, null, 2));
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('SQL exec failed:', e.message);
  process.exit(1);
});
