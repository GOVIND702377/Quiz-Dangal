import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!match) return;
      const [, key, rawValue] = match;
      if (process.env[key]) return;
      let value = rawValue.trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch (err) {
    // ignore missing files
  }
}

loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL missing. Please add it to .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const { rows } = await client.query(`
    select routine_name, routine_type
    from information_schema.routines
    where specific_schema = 'public'
      and routine_name in ('admin_bulk_upsert_questions', 'join_quiz', 'handle_referral_bonus');
  `);
  console.log('Found routines:', rows);
} catch (err) {
  console.error('Error querying routines:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
