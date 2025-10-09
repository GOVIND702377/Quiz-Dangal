#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnvFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
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
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {}
}

parseEnvFile(path.join(__dirname, '..', '.env.local'));
parseEnvFile(path.join(__dirname, '..', '.env'));

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing. Please set it in .env.local');
  process.exit(1);
}

const sqlArg = process.argv.slice(2).join(' ').trim();
if (!sqlArg) {
  console.error('Usage: npm run sql:run -- "SELECT now();" OR pass a file path with @file.sql');
  process.exit(1);
}

let sql = sqlArg;
if (sqlArg.startsWith('@')) {
  const filePath = sqlArg.slice(1);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  sql = fs.readFileSync(filePath, 'utf8');
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const start = Date.now();
  const res = await client.query(sql);
  const ms = Date.now() - start;
  if (Array.isArray(res?.rows)) {
    console.log(JSON.stringify({ rowCount: res.rowCount ?? res.rows.length, rows: res.rows, tookMs: ms }, null, 2));
  } else if (Array.isArray(res)) {
    console.log(JSON.stringify(res.map(r => ({ rowCount: r.rowCount, fields: r.fields?.map(f=>f.name) })), null, 2));
  } else {
    console.log('Done.');
  }
} catch (e) {
  console.error('SQL error:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
