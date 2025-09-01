// Cleanup 'transactions' and recompute totals using Supabase service role
// Usage: node scripts/cleanup-supabase.mjs

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

const suspiciousPatterns = ['test','dummy','fake','seed','manual','add coin','demo'];
const positiveTypes = new Set(['daily_login','referral_bonus','quiz_reward','reward','credit','refund','referral','win','deposit']);
const negativeTypes = new Set(['debit','purchase','redeem','withdraw','spend','withdraw']);

async function deleteSuspiciousTransactions() {
  for (const p of suspiciousPatterns) {
    const orFilter = `type.ilike.%${p}%,description.ilike.%${p}%`;
    const { error } = await supabase
      .from('transactions')
      .delete()
      .or(orFilter);
    if (error) {
      console.warn(`⚠️  Delete pattern '${p}' warning:`, error.message);
    } else {
      console.log(`🧹 Deleted transactions with pattern '${p}'`);
    }
  }
  const { error: highErr } = await supabase
    .from('transactions')
    .delete()
    .gt('amount', 1000000);
  if (highErr) console.warn('⚠️  Delete high amount warning:', highErr.message);
  else console.log('🧹 Deleted transactions with amount > 1,000,000');
}

async function fetchAllTransactions() {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('transactions')
      .select('user_id, type, amount', { count: 'exact' })
      .range(from, to);
    if (error) throw error;
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function recomputeTotals() {
  console.log('⏳ Loading all transactions...');
  const rows = await fetchAllTransactions();
  console.log(`📦 Loaded ${rows.length} transactions`);

  const totals = new Map();
  for (const r of rows) {
    const uid = r.user_id;
    const t = String(r.type || '').toLowerCase();
    const amt = Number(r.amount) || 0;
    let cur = totals.get(uid) || 0;
    if (positiveTypes.has(t)) cur += Math.abs(amt);
    else if (negativeTypes.has(t)) cur -= Math.abs(amt);
    totals.set(uid, cur);
  }

  console.log(`⏳ Updating ${totals.size} profiles totals...`);
  let i = 0;
  for (const [userId, total] of totals.entries()) {
    const val = Math.max(0, Math.trunc(total));
    const { error } = await supabase
      .from('profiles')
      .update({ total_coins: val, wallet_balance: val })
      .eq('id', userId);
    if (error) console.warn(`⚠️  Update ${userId} failed:`, error.message);
    if (++i % 200 === 0) console.log(`...updated ${i}`);
  }
  console.log('✅ Profiles totals updated');
}

(async function main() {
  try {
    await deleteSuspiciousTransactions();
    await recomputeTotals();
    console.log('���� Cleanup complete');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exitCode = 1;
  }
})();
