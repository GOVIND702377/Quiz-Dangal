#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/apply-sql.mjs <path-to-sql>');
  process.exit(1);
}

const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(abs)) {
  console.error('SQL file not found:', abs);
  process.exit(1);
}

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing in env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const main = async () => {
  const sql = fs.readFileSync(abs, 'utf8');
  await client.connect();
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query('commit');
    console.log('Applied SQL OK:', abs);
  } catch (e) {
    await client.query('rollback');
    console.error('Apply failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
