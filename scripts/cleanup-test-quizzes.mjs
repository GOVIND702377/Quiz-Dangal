import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
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

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const main = async () => {
  await client.connect();
  await client.query('begin');
  const { rowCount } = await client.query(
    `update public.quizzes
        set status = 'draft',
            prize_pool = 0,
            prizes = '[]'::jsonb,
            prize_type = 'money'
      where title like 'Debug Quiz%'
         or title like 'Fallback test%'`
  );
  await client.query('commit');
  console.log('Marked debug quizzes as draft:', rowCount);
  await client.end();
};

main().catch(async (err) => {
  console.error(err);
  try {
    await client.query('rollback');
  } catch {}
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
