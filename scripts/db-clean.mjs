// Direct Postgres cleanup using DATABASE_URL
// Usage: node scripts/db-clean.mjs

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL missing in .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

function quoteIdent(id) { return '"' + id.replace(/"/g, '""') + '"'; }

async function detectSchema() {
  const r1 = await client.query(`select to_regclass('public.coins_transactions') as t`);
  const r2 = await client.query(`select to_regclass('public.transactions') as t`);
  const table = r1.rows[0].t ? 'coins_transactions' : (r2.rows[0].t ? 'transactions' : null);
  if (!table) throw new Error('No coins_transactions or transactions table found');

  const cols = await client.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
    [table]
  );
  const names = new Set(cols.rows.map(r => r.column_name));
  const amountCol = names.has('coins_amount') ? 'coins_amount' : (names.has('amount') ? 'amount' : null);
  const typeCol = names.has('transaction_type') ? 'transaction_type' : (names.has('type') ? 'type' : null);
  const descCol = names.has('description') ? 'description' : null;
  if (!amountCol || !typeCol) throw new Error(`Missing amount/type columns in ${table}`);

  // profile columns
  const pcols = await client.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name='profiles'`
  );
  const pnames = new Set(pcols.rows.map(r => r.column_name));
  const hasTotalCoins = pnames.has('total_coins');
  const hasWalletBalance = pnames.has('wallet_balance');

  return { table, amountCol, typeCol, descCol, hasTotalCoins, hasWalletBalance };
}

async function cleanup({ table, amountCol, typeCol, descCol }) {
  const patterns = ['test','dummy','fake','seed','manual','add coin','demo'];
  const likeList = patterns.map(p => `%${p}%`);
  // Build predicate
  const whereParts = [
    `lower(${quoteIdent(typeCol)}) like any ($1)`
  ];
  if (descCol) whereParts.push(`lower(coalesce(${quoteIdent(descCol)},'')) like any ($1)`);
  whereParts.push(`${quoteIdent(amountCol)} > 1000000`);
  const sql = `delete from public.${quoteIdent(table)} where ${whereParts.join(' or ')}`;
  const res = await client.query(sql, [likeList]);
  console.log(`🧹 Deleted rows: ${res.rowCount} from ${table}`);
}

async function recalc({ table, amountCol, typeCol, hasTotalCoins, hasWalletBalance }) {
  const posTypes = ['daily_login','referral_bonus','quiz_reward','reward','credit','refund','referral','win','deposit'];
  const negTypes = ['debit','purchase','redeem','withdraw','spend','withdraw'];

  // Build update SET clause dynamically
  const sets = [];
  if (hasTotalCoins) sets.push(`total_coins = greatest(0, coalesce(tx.net,0))`);
  if (hasWalletBalance) sets.push(`wallet_balance = greatest(0, coalesce(tx.net,0))`);
  if (sets.length === 0) {
    console.log('No total_coins/wallet_balance columns to update, skipping recalc');
    return;
  }

  const sql = `
    with tx as (
      select user_id,
             sum(case when lower(${quoteIdent(typeCol)}) = any($1) then abs(${quoteIdent(amountCol)})
                      when lower(${quoteIdent(typeCol)}) = any($2) then -abs(${quoteIdent(amountCol)})
                      else 0 end) as net
        from public.${quoteIdent(table)}
       group by user_id
    )
    update public.profiles p
       set ${sets.join(', ')}
      from tx
     where p.id = tx.user_id;
  `;
  const res = await client.query(sql, [posTypes, negTypes]);
  console.log(`✅ Profiles updated: ${res.rowCount}`);
}

(async function main() {
  try {
    await client.connect();
    await client.query('begin');
    const schema = await detectSchema();
    await cleanup(schema);
    await recalc(schema);
    await client.query('commit');
    console.log('🎉 Cleanup and recalculation complete');
  } catch (e) {
    try { await client.query('rollback'); } catch {}
    console.error('❌ Error:', e.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
