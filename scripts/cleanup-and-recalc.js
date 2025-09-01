// Cleanup and Recalculate Coins Script
// Usage: node scripts/cleanup-and-recalc.js

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

(async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRole);
  console.log('🔗 Connected to Supabase');

  // 1) Delete suspicious/fake transactions from coins_transactions
  const patterns = ['test', 'dummy', 'fake', 'seed', 'manual', 'add coin', 'demo'];
  try {
    for (const p of patterns) {
      const orFilter = `transaction_type.ilike.%${p}%,description.ilike.%${p}%`;
      const { error } = await supabase
        .from('coins_transactions')
        .delete()
        .or(orFilter);
      if (error) console.warn(`⚠️  Delete by pattern '${p}' warning:`, error.message);
      else console.log(`🧹 Deleted transactions matching '${p}'`);
    }
    // Delete absurdly high amounts
    const { error: highErr } = await supabase
      .from('coins_transactions')
      .delete()
      .gt('coins_amount', 1000000);
    if (highErr) console.warn('⚠️  Delete high-amount rows warning:', highErr.message);
    else console.log('🧹 Deleted transactions with coins_amount > 1,000,000');
  } catch (e) {
    console.warn('⚠️  Cleanup step had issues:', e.message);
  }

  // 2) Recalculate totals per user and update profiles
  // Preferred: run a single SQL UPDATE via exec_sql if available
  const recalcSQL = `
    with sums as (
      select user_id,
             coalesce(sum(coins_amount) filter (where transaction_type in ('daily_login','referral_bonus','quiz_reward','reward','credit','refund','referral')),0) as credits,
             coalesce(sum(coins_amount) filter (where transaction_type in ('debit','purchase','redeem','withdraw','spend')),0) as debits
        from public.coins_transactions
       group by user_id
    )
    update public.profiles p
       set total_coins = greatest(0, coalesce(s.credits,0) - coalesce(s.debits,0)),
           wallet_balance = greatest(0, coalesce(s.credits,0) - coalesce(s.debits,0))
      from sums s
     where p.id = s.user_id;
  `;

  let usedSQL = false;
  try {
    const { error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: recalcSQL });
    if (rpcErr) {
      console.warn('⚠️  exec_sql not available or failed, falling back to client-side aggregation:', rpcErr.message);
    } else {
      usedSQL = true;
      console.log('✅ Recalculated totals via SQL');
    }
  } catch (e) {
    console.warn('⚠️  exec_sql call failed, falling back to client-side aggregation:', e.message);
  }

  if (!usedSQL) {
    try {
      // Pull minimal fields to aggregate
      const { data: tx, error: txErr } = await supabase
        .from('coins_transactions')
        .select('user_id, transaction_type, coins_amount');
      if (txErr) throw txErr;

      const posTypes = new Set(['daily_login','referral_bonus','quiz_reward','reward','credit','refund','referral']);
      const negTypes = new Set(['debit','purchase','redeem','withdraw','spend']);
      const totals = new Map();

      for (const row of tx || []) {
        const uid = row.user_id;
        const amt = Number(row.coins_amount) || 0;
        let cur = totals.get(uid) || 0;
        const t = String(row.transaction_type || '').toLowerCase();
        if (posTypes.has(t)) cur += Math.abs(amt);
        else if (negTypes.has(t)) cur -= Math.abs(amt);
        totals.set(uid, cur);
      }

      // Batch updates
      let i = 0;
      for (const [userId, total] of totals.entries()) {
        const val = Math.max(0, Math.trunc(total));
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ total_coins: val, wallet_balance: val })
          .eq('id', userId);
        if (updErr) console.warn(`⚠️  Update profile ${userId} failed:`, updErr.message);
        if (++i % 100 === 0) console.log(`...updated ${i} profiles`);
      }
      console.log(`✅ Recalculated totals for ${i} users via client-side aggregation`);
    } catch (e) {
      console.error('❌ Failed recalculation fallback:', e.message);
    }
  }

  console.log('🎉 Cleanup and recalculation complete');
  process.exit(0);
})();
