// Cleanup and Recalculate Coins Script (ESM)
// Usage: node scripts/cleanup-and-recalc.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRole = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !serviceRole) {
  console.error('Missing Supabase credentials. Ensure VITE_SUPABASE_URL/VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/SUPABASE_SERVICE_ROLE are set in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceRole);
console.log('🔗 Connected to Supabase');

async function detectSchema() {
  // Find which transactions store exists and its columns
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['coins_transactions', 'transactions']);
  if (error) throw error;
  const names = new Set((tables || []).map(t => t.table_name));
  const table = names.has('coins_transactions') ? 'coins_transactions' : names.has('transactions') ? 'transactions' : null;
  if (!table) throw new Error('No coins_transactions or transactions table found');

  const { data: cols, error: colErr } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table);
  if (colErr) throw colErr;
  const colset = new Set((cols || []).map(c => c.column_name));

  const amountCol = colset.has('coins_amount') ? 'coins_amount' : colset.has('amount') ? 'amount' : null;
  const typeCol = colset.has('transaction_type') ? 'transaction_type' : colset.has('type') ? 'type' : null;
  const descCol = colset.has('description') ? 'description' : null;
  if (!amountCol || !typeCol) throw new Error(`Missing amount/type columns in ${table}`);

  // Profile columns
  const { data: pcols, error: pcErr } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'profiles');
  if (pcErr) throw pcErr;
  const pset = new Set((pcols || []).map(c => c.column_name));
  const hasTotalCoins = pset.has('total_coins');
  const hasWalletBalance = pset.has('wallet_balance');

  return { table, amountCol, typeCol, descCol, hasTotalCoins, hasWalletBalance };
}

async function cleanup(schema) {
  const { table, amountCol, typeCol, descCol } = schema;
  // Delete suspicious/fake transactions
  const patterns = ['test', 'dummy', 'fake', 'seed', 'manual', 'add coin', 'demo'];
  for (const p of patterns) {
    let orFilter = `${typeCol}.ilike.%${p}%`;
    if (descCol) orFilter += `,${descCol}.ilike.%${p}%`;
    const { error } = await supabase
      .from(table)
      .delete()
      .or(orFilter);
    if (error) console.warn(`⚠️  Delete by pattern '${p}' warning:`, error.message);
    else console.log(`🧹 Deleted ${table} rows matching '${p}'`);
  }
  // Delete absurdly high amounts
  const { error: highErr } = await supabase
    .from(table)
    .delete()
    .gt(amountCol, 1000000);
  if (highErr) console.warn('⚠️  Delete high-amount rows warning:', highErr.message);
  else console.log(`🧹 Deleted ${table} rows with ${amountCol} > 1,000,000`);
}

async function recalc(schema) {
  const { table, amountCol, typeCol, hasTotalCoins, hasWalletBalance } = schema;
  // Fetch minimal set
  const { data: tx, error: txErr } = await supabase
    .from(table)
    .select(`user_id, ${typeCol}, ${amountCol}`);
  if (txErr) throw txErr;

  // Known types across both schemas
  const pos = new Set(['daily_login','referral_bonus','quiz_reward','reward','credit','refund','referral','win','deposit']);
  const neg = new Set(['debit','purchase','redeem','withdraw','spend','withdraw']);

  const totals = new Map();
  for (const row of tx || []) {
    const uid = row.user_id;
    const amt = Number(row[amountCol]) || 0;
    const t = String(row[typeCol] || '').toLowerCase();
    let cur = totals.get(uid) || 0;
    if (pos.has(t)) cur += Math.abs(amt);
    else if (neg.has(t)) cur -= Math.abs(amt);
    totals.set(uid, cur);
  }

  let i = 0;
  for (const [userId, total] of totals.entries()) {
    const val = Math.max(0, Math.trunc(total));
    const payload = {};
    if (hasTotalCoins) payload.total_coins = val;
    if (hasWalletBalance) payload.wallet_balance = val;
    if (Object.keys(payload).length === 0) continue;
    const { error: updErr } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);
    if (updErr) console.warn(`⚠️  Update profile ${userId} failed:`, updErr.message);
    if (++i % 100 === 0) console.log(`...updated ${i} profiles`);
  }
  console.log(`✅ Recalculated totals for ${i} users`);
}

(async function main() {
  try {
    const schema = await detectSchema();
    await cleanup(schema);
    await recalc(schema);
    console.log('🎉 Cleanup and recalculation complete');
  } catch (e) {
    console.error('❌ Fatal:', e.message);
  }
})();
