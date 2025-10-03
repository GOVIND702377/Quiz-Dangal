import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
// removed Button import; using Link for consistency across actions
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Share2, Gift, Trophy, ArrowDownRight, ArrowUpRight, UserPlus, RefreshCcw, ShoppingBag, LogOut, Wallet as WalletIcon, Sparkles, Gamepad2 } from 'lucide-react';
// useNavigate not needed; using Link for navigation

const Wallet = () => {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bouncing, setBouncing] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  // Refer & Earn now opens as a full page (/refer). Modal toggle removed.

  // Align with DB check constraint on transactions.type
  const allowedTypes = ['credit','reward','bonus','referral','daily_login','quiz_reward','purchase','debit','refund','join_fee','prize'];
  const positiveTypes = ['reward','bonus','credit','referral','refund','daily_login','quiz_reward','prize'];

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .in('type', allowedTypes)
          .not('type', 'is', null)
          .not('amount', 'is', null)
          .neq('amount', 0)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) console.error(error);
        setTransactions(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user]);

  const walletBalance = Number(userProfile?.wallet_balance || 0);
  const [prevBalance, setPrevBalance] = useState(walletBalance);
  useEffect(() => {
    if (walletBalance > prevBalance) {
      setBouncing(true);
      const t = setTimeout(() => setBouncing(false), 600);
      return () => clearTimeout(t);
    }
    setPrevBalance(walletBalance);
  }, [walletBalance, prevBalance]);

  const formatCoins = (n) => Number(n || 0).toLocaleString();

  // Quick stats from the last 10 transactions (visible list)
  const earnedLast10 = transactions
    .filter((t) => positiveTypes.includes(String(t?.type || '').toLowerCase()))
    .reduce((sum, t) => sum + Math.abs(Number(t?.amount) || 0), 0);
  const spentLast10 = transactions
    .filter((t) => !positiveTypes.includes(String(t?.type || '').toLowerCase()))
    .reduce((sum, t) => sum + Math.abs(Number(t?.amount) || 0), 0);

  const txMeta = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('ref')) return { icon: UserPlus, tint: 'bg-sky-500/15', ring: 'ring-sky-400/40', text: 'text-sky-200' };
    if (t.includes('quiz') || t.includes('prize') || t.includes('reward')) return { icon: Trophy, tint: 'bg-emerald-500/10', ring: 'ring-emerald-400/40', text: 'text-emerald-200' };
    if (t.includes('credit') || t.includes('daily')) return { icon: Coins, tint: 'bg-amber-500/15', ring: 'ring-amber-300/50', text: 'text-amber-200' };
    if (t.includes('refund')) return { icon: RefreshCcw, tint: 'bg-indigo-500/15', ring: 'ring-indigo-400/40', text: 'text-indigo-200' };
    if (t.includes('purchase')) return { icon: ShoppingBag, tint: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-400/40', text: 'text-fuchsia-200' };
    if (t.includes('debit') || t.includes('join') || t.includes('redeem') || t.includes('spend')) return { icon: LogOut, tint: 'bg-rose-500/10', ring: 'ring-rose-400/40', text: 'text-rose-200' };
    return { icon: WalletIcon, tint: 'bg-slate-500/10', ring: 'ring-slate-400/40', text: 'text-slate-200' };
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6">
      {/* Soft gradient mesh backdrop */}
      <div className="absolute inset-0 -z-10 opacity-70 mix-blend-screen [background-image:radial-gradient(circle_at_18%_28%,rgba(56,189,248,0.25),rgba(0,0,0,0)60%),radial-gradient(circle_at_82%_72%,rgba(192,132,252,0.22),rgba(0,0,0,0)65%),radial-gradient(circle_at_50%_50%,rgba(244,114,182,0.15),rgba(0,0,0,0)55%)]" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-5 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent tracking-tight">Wallet</h1>

        {/* Balance + quick actions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl p-6 md:p-7 mb-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl"
        >
          {/* sheen */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-10 bg-[conic-gradient(from_210deg_at_50%_50%,rgba(99,102,241,0.15),rgba(139,92,246,0.1),rgba(56,189,248,0.12),transparent_60%)]"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 24, ease: 'linear' }}
          />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* balance */}
            <div className="flex-1 flex items-start gap-4">
              <motion.div
                animate={bouncing ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative w-14 h-14 md:w-16 md:h-16 shrink-0 aspect-square rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)] ring-2 ring-amber-300/50 bg-[linear-gradient(140deg,#ffe9b0,#f9cf55,#f6b530,#f9cf55,#ffe9b0)]"
                aria-hidden
              >
                <Coins size={28} className="text-white drop-shadow" />
                <motion.span className="pointer-events-none absolute inset-0 rounded-full" initial={{ opacity: 0.25 }} animate={{ opacity: [0.2, 0.45, 0.2] }} transition={{ duration: 2.2, repeat: Infinity }} />
              </motion.div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-slate-300/70 font-semibold">Coins Balance</div>
                <div className="text-[2.2rem] md:text-[2.6rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-300 leading-tight drop-shadow-sm">
                  {formatCoins(walletBalance)} <span className="text-base align-middle font-bold text-amber-200/90">coins</span>
                </div>
                <div className="mt-1 text-sm md:text-base text-slate-300/85">Win quizzes, refer friends, and redeem awesome prizes.</div>
                {/* quick stats removed as requested */}
                <div className="mt-2" />
              </div>
            </div>

            {/* quick actions - responsive for phone & pc; left: Refer & earn, right: Redeem */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              <Link
                to="/refer"
                className="relative inline-flex w-full items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 text-white shadow-[0_8px_22px_rgba(16,185,129,0.35)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition border border-emerald-300/40"
              >
                <Share2 className="w-4 h-4" />
                Refer & Earn
              </Link>
              <Link
                to="/redemptions"
                className="relative inline-flex w-full items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_8px_22px_rgba(139,92,246,0.45)] hover:shadow-[0_12px_28px_rgba(139,92,246,0.55)] hover:scale-[1.02] active:scale-[0.98] transition border border-fuchsia-300/40"
                onMouseEnter={() => setBurstKey((k) => k + 1)}
                onClick={() => {
                  setBurstKey((k) => k + 1);
                  setRippleKey((k) => k + 1);
                }}
              >
                <motion.span
                  key={rippleKey}
                  className="pointer-events-none absolute inset-0 m-auto rounded-full"
                  initial={{ width: 0, height: 0, opacity: 0.35, background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)' }}
                  animate={{ width: 220, height: 220, opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                <Gift className="w-4 h-4" />
                Redeem
              </Link>
              {/* Leaderboard/stats removed */}
            </div>
          </div>
          {/* How to earn chips moved to their own section below */}
        </motion.div>
        {/* Separated actions: Play Quizzes & Refer Friends */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="qd-card rounded-3xl p-5 md:p-6 mb-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base md:text-lg font-semibold bg-gradient-to-r from-cyan-200 via-emerald-200 to-amber-200 bg-clip-text text-transparent">Start earning</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/" className="group flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/15 transition">
              <Gamepad2 className="w-4 h-4 text-cyan-300" />
              <div>
                <div className="text-cyan-200/90 text-xs font-semibold">Play Quizzes</div>
                <div className="text-[11px] text-cyan-200/70">Win coins every game</div>
              </div>
            </Link>
            <Link to="/refer" className="group flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/15 transition">
              <UserPlus className="w-4 h-4 text-emerald-300" />
              <div>
                <div className="text-emerald-200/90 text-xs font-semibold">Refer Friends</div>
                <div className="text-[11px] text-emerald-200/70">Get bonus coins</div>
              </div>
            </Link>
            {/* spacer to balance grid on sm+ */}
            <div className="hidden sm:block" />
          </div>
        </motion.div>
        {/* Featured rewards banner removed as requested */}

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="qd-card rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent drop-shadow">Recent Activity</h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-indigo-900/40 border border-indigo-800/60 shadow-sm">
                  <div className="animate-pulse flex items-center justify-between">
                    <div className="flex items-center space-x-3 w-2/3">
                      <div className="w-8 h-8 rounded-full bg-indigo-800/60" />
                      <div className="flex-1">
                        <div className="h-3 bg-indigo-800/60 rounded w-2/3 mb-2" />
                        <div className="h-2.5 bg-indigo-800/60 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-3 w-16 bg-indigo-800/60 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">🪙</div>
              <p className="text-slate-200 font-semibold">Wallet khali hai — quizzes jeeto aur coins banao!</p>
              <div className="mt-4">
                <Link to="/refer" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <Share2 className="w-4 h-4" /> Refer & Earn
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((t, index) => {
                const type = (t.type || '').toLowerCase();
                const isPositive = positiveTypes.includes(type);
                const meta = txMeta(type);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, scale: [0.99, 1] }}
                    transition={{ duration: 0.25, delay: index * 0.06 }}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-900/40 via-slate-900/20 to-indigo-900/30 rounded-xl border border-indigo-700/60 hover:border-indigo-400/60 shadow-sm hover:shadow-lg transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ring-2 ${meta.ring} ${meta.tint}`}>
                        <Icon className="w-5 h-5 text-white/90" />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold tracking-wide text-sm leading-tight ${meta.text} truncate`}>
                          {t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Transaction'}
                        </p>
                        <p className="text-slate-400/80 text-[11px] font-mono">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 font-extrabold text-sm tabular-nums tracking-wide ${isPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {isPositive ? '+' : '-'}{formatCoins(Math.abs(Number(t.amount) || 0))}
                      <span className="text-[10px] uppercase tracking-wider text-slate-400/70 font-semibold">coins</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Wallet;