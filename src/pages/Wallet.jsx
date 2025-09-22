import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Share2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Wallet = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
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

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-6">
  {/* Background inherits from global home-bg */}
      <div className="absolute inset-0 -z-10 opacity-60 mix-blend-screen [background-image:radial-gradient(circle_at_18%_28%,rgba(99,102,241,0.35),rgba(0,0,0,0)60%),radial-gradient(circle_at_82%_72%,rgba(168,85,247,0.30),rgba(0,0,0,0)65%),radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.18),rgba(0,0,0,0)55%)]" />
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
  <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-4 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">My Wallet</h1>
  {/* Balance Card */}
  <motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} transition={{duration:.5,delay:.1}} className="relative overflow-hidden rounded-3xl p-5 mb-6 qd-card shadow-2xl">
          {/* decorative blobs removed per request */}

          {/* decorative floating coins removed per request */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: Coin icon + balance */}
            <div className="flex items-start gap-3 min-w-[230px] flex-1">
              <motion.div
                animate={bouncing ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative bg-[linear-gradient(140deg,#ffe9b0,#f9cf55,#f6b530,#f9cf55,#ffe9b0)] p-3 rounded-full shadow-[0_0_18px_rgba(250,204,21,0.55)] mt-2 ring-2 ring-amber-300/50"
                aria-hidden
              >
                <Coins size={35} className="text-white drop-shadow" />
                <motion.span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  initial={{ opacity: 0.25 }}
                  animate={{ opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  style={{ boxShadow: '0 0 18px 4px rgba(245,158,11,0.3)' }}
                />
              </motion.div>
              <div>
                <div className="text-sm font-medium text-slate-200/90 tracking-wide">Coins Balance</div>
                <div className="text-[2rem] md:text-[2.4rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 leading-tight drop-shadow-sm">
                  {walletBalance.toLocaleString()} <span className="text-base align-middle font-bold text-amber-200/90">coins</span>
                </div>
                <motion.div
                  className="text-sm md:text-base text-slate-300/80"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  Your wallet is waiting to be filled 💸
                </motion.div>
                {/* Redeem button moved to left, made bigger, with burst animation */}
                <motion.div className="relative mt-4" onMouseEnter={()=>setBurstKey(k=>k+1)} onClick={()=>{setBurstKey(k=>k+1);setRippleKey(k=>k+1);}} animate={{scale:[1,1.02,1]}} transition={{repeat:Infinity,duration:2.2,ease:'easeInOut'}}>
                  <motion.span aria-hidden className="pointer-events-none absolute inset-0 -z-0 rounded-3xl" initial={{boxShadow:'0 0 0px rgba(139,92,246,0.0)'}} animate={{boxShadow:['0 0 0px rgba(139,92,246,0.0)','0 0 26px rgba(139,92,246,0.35)','0 0 0px rgba(139,92,246,0.0)']}} transition={{duration:3.2,repeat:Infinity}} />
                  <Link to="/redemptions" aria-label="Redeem Coins" className="relative inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base md:text-lg bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)] text-white shadow-[0_10px_24px_rgba(139,92,246,0.45)] hover:shadow-[0_14px_32px_rgba(139,92,246,0.6)] hover:scale-[1.03] active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 pr-7 overflow-hidden">
                    <motion.div className="pointer-events-none absolute top-0 -left-1/2 h-full w-1/3 skew-x-12 bg-gradient-to-r from-white/0 via-white/35 to-white/0" initial={{x:'-20%'}} animate={{x:['-20%','160%']}} transition={{duration:2.6,repeat:Infinity,repeatDelay:1.2}} aria-hidden />
                    <motion.span key={rippleKey} className="pointer-events-none absolute inset-0 m-auto rounded-full" initial={{width:0,height:0,opacity:0.35,background:'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)'}} animate={{width:260,height:260,opacity:0}} transition={{duration:0.8,ease:'easeOut'}} aria-hidden />
                    <motion.span initial={{rotate:0}} animate={{rotate:[0,-12,10,-8,0]}} transition={{duration:1.2,repeat:Infinity,repeatDelay:2}} className="inline-flex"><Gift className="w-6 h-6" /></motion.span>
                    <span className="font-extrabold tracking-wide">Redeem Coins</span>
                    <span className="absolute -right-1 -top-1 text-xs bg-amber-200/90 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-300/80 shadow">Prizes</span>
                  </Link>
                </motion.div>
              </div>
            </div>
            {/* Right side empty per design simplification */}
            <div className="ml-auto self-start" />
          </div>

          {/* Progress removed per request */}
        </motion.div>

  {/* Refer & Earn */}
  <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.5,delay:.15}} className="qd-card rounded-2xl p-4 shadow-xl mb-6 text-slate-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Quiz Dangal" className="w-9 h-9 rounded-xl ring-2 ring-white/40" onError={(e) => { e.currentTarget.src='/android-chrome-512x512.png'; }} />
              <div>
                <div className="text-base font-bold tracking-wide">Refer & Earn</div>
                <div className="text-sm opacity-80">Invite friends, they join — you earn rewards</div>
              </div>
            </div>
            <Button onClick={() => navigate('/refer')} className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white hover:opacity-90 px-3 py-1.5 text-sm border border-indigo-300/40 shadow">
              <Share2 className="w-4 h-4 mr-2" /> Refer & Earn
            </Button>
          </div>

        </motion.div>

  {/* Recent Activity */}
  <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.5,delay:.2}} className="qd-card rounded-3xl p-6 shadow-xl relative overflow-hidden">
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
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🪙</div>
        <p className="text-slate-200 font-semibold">Your wallet’s hungry — feed it with wins 💰</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((t, index) => {
                const type = (t.type||'').toLowerCase();
                const isPositive = positiveTypes.includes(type);
                const isReferral = type.includes('ref');
                const isSpend = type.includes('redeem') || type.includes('debit') || type.includes('spend');
                const typeColor = isReferral ? 'text-sky-200' : isPositive ? 'text-emerald-200' : isSpend ? 'text-rose-200' : 'text-slate-100';
                const amountColor = isPositive ? 'text-emerald-300' : isSpend ? 'text-rose-300' : 'text-indigo-200';
                return (
                  <motion.div key={t.id} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:index*0.08}} className="flex items-center justify-between p-3 bg-indigo-900/40 rounded-lg border border-indigo-700/60 hover:border-indigo-400/60 shadow-sm hover:shadow-lg transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-amber-300/50 shadow-md bg-[linear-gradient(140deg,#ffe9b0,#f9cf55,#f6b530,#f9cf55,#ffe9b0)]">
                        <Coins className="w-6 h-6 text-white drop-shadow" />
                        <span className="pointer-events-none absolute inset-0 rounded-full mix-blend-overlay bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.55),rgba(255,255,255,0)_60%)]" />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold tracking-wide text-sm leading-tight ${typeColor} truncate`}>{t.type ? t.type.charAt(0).toUpperCase()+t.type.slice(1) : 'Transaction'}</p>
                        <p className="text-slate-400/80 text-[11px] font-mono">{new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className={`font-bold text-sm tabular-nums tracking-wide ${amountColor}`}>
                      {isPositive?'+':'-'}{Math.abs(Number(t.amount)||0)} <span className="text-[11px] uppercase tracking-wider text-slate-400/70 font-medium">coins</span>
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