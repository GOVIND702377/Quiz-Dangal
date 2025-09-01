import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Share2, Gift } from 'lucide-react';
import ReferEarnModal from '@/components/ReferEarnModal';

const Wallet = () => {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bouncing, setBouncing] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [showReferEarn, setShowReferEarn] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching transactions:', error);
        } else {
          setTransactions(data || []);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user]);

  const walletBalance = Number(userProfile?.wallet_balance || 0);

  // Bounce animate coin when balance increases
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
    <div className="container mx-auto px-4 py-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
  {/* Main heading centered in blue */}
  <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">My Wallet</h1>
  {/* Refer & Earn stays below */}

  {/* Coins Balance card - compact with coin left and Redeem left */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl p-3 md:p-4 mb-2 shadow-xl ring-1 ring-black/5 border border-white/40 bg-white/70 backdrop-blur-xl"
        >
          {/* decorative blobs removed per request */}

          {/* decorative floating coins removed per request */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: Coin icon + balance */}
            <div className="flex items-start gap-3 min-w-[230px] flex-1">
              <motion.div
                animate={bouncing ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative bg-gradient-to-r from-yellow-400 to-amber-500 p-3 rounded-full shadow-[0_0_14px_rgba(245,158,11,0.45)] mt-2"
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
                <div className="text-sm font-medium text-gray-700 tracking-wide">Coins Balance</div>
                <div className="text-[2rem] md:text-[2.4rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-500 leading-tight">
                  {walletBalance.toLocaleString()} coins
                </div>
                <motion.div
                  className="text-sm md:text-base text-gray-700"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  Your wallet is waiting to be filled 💸
                </motion.div>
                {/* Redeem button moved to left, made bigger, with burst animation */}
                <motion.div
                  className="relative mt-3"
                  onMouseEnter={() => setBurstKey((k) => k + 1)}
                  onClick={() => { setBurstKey((k) => k + 1); setRippleKey((k) => k + 1); }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                >
                  {/* burst particles */}
                  <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 select-none">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const dx = (Math.random() * 70) - 35; // -35 to 35 px
                      const dy = 60 + Math.random() * 20; // 60-80 px up
                      const rot = (Math.random() * 30) - 15;
                      const delay = i * 0.06;
                      const emoji = i % 2 === 0 ? '🪙' : '🎁';
                      return (
                        <motion.span
                          key={`${burstKey}-${i}`}
                          initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0.9 }}
                          animate={{ opacity: [0.95, 0], y: [-6, -dy], x: [0, dx], rotate: [0, rot], scale: [1, 1.05] }}
                          transition={{ duration: 1.1, delay, ease: 'easeOut' }}
                          className="absolute text-lg will-change-transform"
                          style={{ left: 0 }}
                        >
                          {emoji}
                        </motion.span>
                      );
                    })}
                  </div>

                  {/* glowing ring behind button */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-0 rounded-3xl"
                    initial={{ boxShadow: '0 0 0px rgba(236,72,153,0.0)' }}
                    animate={{ boxShadow: ['0 0 0px rgba(236,72,153,0.0)', '0 0 28px rgba(236,72,153,0.35)', '0 0 0px rgba(236,72,153,0.0)'] }}
                    transition={{ duration: 3.2, repeat: Infinity }}
                  />

                  <Link
                    to="/redemptions"
                    aria-label="Redeem Coins"
                    className="relative inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base md:text-lg bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-500 text-white shadow-[0_10px_24px_rgba(236,72,153,0.35)] hover:shadow-[0_14px_30px_rgba(236,72,153,0.5)] hover:scale-[1.03] active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-rose-300 pr-7 overflow-hidden"
                  >
                    {/* shine sweep */}
                    <motion.div
                      className="pointer-events-none absolute top-0 -left-1/2 h-full w-1/3 skew-x-12 bg-gradient-to-r from-white/0 via-white/35 to-white/0"
                      initial={{ x: '-20%' }}
                      animate={{ x: ['-20%', '160%'] }}
                      transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.2 }}
                      aria-hidden
                    />
                    {/* click ripple */}
                    <motion.span
                      key={rippleKey}
                      className="pointer-events-none absolute inset-0 m-auto rounded-full"
                      initial={{ width: 0, height: 0, opacity: 0.35, background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)' }}
                      animate={{ width: 260, height: 260, opacity: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      aria-hidden
                    />
                    <motion.span
                      initial={{ rotate: 0 }}
                      animate={{ rotate: [0, -12, 10, -8, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
                      className="inline-flex"
                    >
                      <Gift className="w-6 h-6" />
                    </motion.span>
                    <span className="font-extrabold tracking-wide">Redeem Coins</span>
                    <span className="absolute -right-1 -top-1 text-xs bg-white/90 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-200 shadow">Prizes</span>
                  </Link>
                </motion.div>
              </div>
            </div>
            {/* Right side empty per design simplification */}
            <div className="ml-auto self-start" />
          </div>

          {/* Progress removed per request */}
        </motion.div>

        {/* Refer & Earn - moved below wallet card (slightly smaller) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl p-3 shadow-lg mb-2 border border-indigo-200 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 text-white"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <img src="/android-chrome-512x512.png" alt="Quiz Dangal" className="w-9 h-9 rounded-xl ring-2 ring-white/40" />
              <div>
                <div className="text-base font-bold">Refer & Earn</div>
                <div className="text-sm opacity-90">Invite friends, they join — you earn rewards</div>
              </div>
            </div>
            <Button onClick={() => setShowReferEarn(true)} className="bg-white text-indigo-700 hover:bg-white/90 px-2.5 py-1.5 text-sm">
              <Share2 className="w-4 h-4 mr-2" /> Refer & Earn
            </Button>
          </div>

        </motion.div>

        {/* Recent Activity - glass card + skeletons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-3xl p-6 bg-white/70 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
          </div>
          
      {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/70 border border-gray-100/60 shadow-sm">
                  <div className="animate-pulse flex items-center justify-between">
                    <div className="flex items-center space-x-3 w-2/3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                        <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🪙</div>
        <p className="text-gray-800 font-semibold">Your wallet’s hungry — feed it with wins 💰</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-white/80 rounded-lg border border-gray-100/70 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-white border flex items-center justify-center w-8 h-8">
                      <span className="text-lg" aria-hidden>
                        {(() => {
                          const t = (transaction.type || '').toLowerCase();
                          if (t.includes('ref')) return '👥';
                          if (t.includes('redeem') || t.includes('debit') || t.includes('spend')) return '🎁';
                          if (t.includes('quiz') || t.includes('reward') || t.includes('bonus') || t.includes('credit')) return '🎯';
                          return '🪙';
                        })()}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">
                        {transaction.type ? transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1) : 'Transaction'}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    ['reward','bonus','credit','referral','refund'].includes(transaction.type) ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {['reward','bonus','credit','referral','refund'].includes(transaction.type) ? '+' : '-'}{Math.abs(Number(transaction.amount) || 0)} coins
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Refer & Earn Modal */}
      <ReferEarnModal
        isOpen={showReferEarn}
        onClose={() => setShowReferEarn(false)}
      />
    </div>
  );
};

export default Wallet;