import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in .env.local');
  process.exit(1);
}

const sql = `
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('profiles','coins_transactions','daily_streaks','referrals')
order by tablename, policyname;
`;

const run = async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(sql);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
};

run().catch((e) => { console.error(e.message); process.exit(1); });
