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
      const orFilter = `type.ilike.%${p}%,description.ilike.%${p}%`;
      const { error } = await supabase
        .from('transactions')
        .delete()
        .or(orFilter);
      if (error) console.warn(`⚠️  Delete by pattern '${p}' warning:`, error.message);
      else console.log(`🧹 Deleted transactions matching '${p}'`);
    }
    // Delete absurdly high amounts
    const { error: highErr } = await supabase
      .from('transactions')
      .delete()
      .gt('amount', 1000000);
    if (highErr) console.warn('⚠️  Delete high-amount rows warning:', highErr.message);
    else console.log('🧹 Deleted transactions with amount > 1,000,000');
  } catch (e) {
    console.warn('⚠️  Cleanup step had issues:', e.message);
  }

  // 2) Recalculate totals per user and update profiles
  // Preferred: run a single SQL UPDATE via exec_sql if available
  const recalcSQL = `
    WITH sums AS (
      SELECT
        user_id,
        COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS credits,
        COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS debits
      FROM public.transactions
      GROUP BY user_id
    )
    update public.profiles p
       set total_earned = s.credits,
           total_spent = s.debits,
           wallet_balance = s.credits - s.debits
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
        .select('user_id, amount');
      if (txErr) throw txErr;

      const totals = new Map();

      for (const row of tx || []) {
        const uid = row.user_id;
        const amt = Number(row.amount) || 0;
        let userTotals = totals.get(uid) || { earned: 0, spent: 0 };
        if (amt > 0) {
          userTotals.earned += amt;
        } else {
          userTotals.spent += Math.abs(amt);
        }
        totals.set(uid, userTotals);
      }

      // Batch updates
      let i = 0;
      for (const [userId, userTotals] of totals.entries()) {
        const { earned, spent } = userTotals;
        const balance = earned - spent;
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ total_earned: earned, total_spent: spent, wallet_balance: balance })
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
