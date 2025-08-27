import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, ArrowDownLeft, Trophy, Share2, Copy, Check, ExternalLink, Gift } from 'lucide-react';

const Wallet = () => {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bouncing, setBouncing] = useState(false);

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

  // Add Money / Withdraw removed as per new wallet design

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

  // Refer & Earn (migrated from Rewards)
  const getReferralLink = () => {
    const code = userProfile?.referral_code || user?.id || '';
    return `${window.location.origin}?ref=${encodeURIComponent(code)}`;
  };

  const handleShareInvite = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please login to share your referral link.' });
      return;
    }
    setSharing(true);
    const shareUrl = getReferralLink();
    const shareText = 'Join me on Quiz Dangal — Play daily quizzes, win coins and redeem rewards! Use my link to sign up:';
    try {
      const shareData = { title: 'Quiz Dangal - Refer & Earn', text: `${shareText} ${shareUrl}`, url: shareUrl };
      try {
        const res = await fetch('/android-chrome-512x512.png');
        const blob = await res.blob();
        const file = new File([blob], 'quiz-dangal.png', { type: blob.type || 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
      } catch {}
      if (navigator.share) {
        await navigator.share(shareData);
        toast({ title: 'Thanks for sharing!', description: 'Your referral link has been shared.' });
        setShowShareOptions(false);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setShowShareOptions(true);
        setTimeout(() => setCopied(false), 1500);
        toast({ title: 'Link copied', description: 'Share via your favorite app below.' });
      }
    } catch (e) {
      setShowShareOptions(true);
      toast({ title: 'Share failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const shareUrl = getReferralLink();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent('Join me on Quiz Dangal — Play daily quizzes, win coins and redeem rewards!');
  const shareLinks = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
  <h1 className="text-3xl font-bold gradient-text mb-8 text-center">My Wallet</h1>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl p-6 mb-6 text-center shadow-lg border border-amber-100 bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100"
        >
          {/* Floating coins on open */}
          <motion.div
            className="pointer-events-none absolute -bottom-6 left-6 text-yellow-400"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 0.6, y: -8 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          >
            <Coins size={20} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute -bottom-8 right-10 text-amber-400"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 0.6, y: -10 }}
            transition={{ duration: 1.2, delay: 0.35 }}
          >
            <Coins size={16} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute -bottom-10 left-1/2 text-yellow-500"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 0.6, y: -12 }}
            transition={{ duration: 1.2, delay: 0.5 }}
          >
            <Coins size={14} />
          </motion.div>

          <div className="flex justify-center mb-4">
            <motion.div
              animate={bouncing ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 p-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)]"
            >
              <Coins size={32} className="text-white drop-shadow" />
            </motion.div>
          </div>
          <div className="text-sm font-medium text-gray-600 tracking-wide">Coins Balance</div>
          <div className="text-4xl font-extrabold text-amber-600 mb-1">{walletBalance.toLocaleString()} coins</div>
          <div className="text-sm text-gray-600">👉 Keep playing, keep earning!</div>

          {/* Streak and progress */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="text-sm text-gray-700">
              🔥 Streak Counter: <span className="font-semibold">Day {Number(userProfile?.streak_count || 0)}</span>
              {Number(userProfile?.streak_count || 0) === 0 ? ' → Start playing to build streaks!' : ''}
            </div>
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-1 text-[11px] text-gray-700">
                <span>Progress to next reward</span>
                <span>100 coins → Next Reward</span>
              </div>
              {(() => {
                const target = 100;
                const pct = Math.min(100, Math.round(((walletBalance % target) / target) * 100));
                return (
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                );
              })()}
              <div className="text-[11px] text-gray-500 mt-1">More Quizzes = More Coins = More Rewards!</div>
            </div>
          </div>
        </motion.div>

        {/* Refer & Earn */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl p-6 shadow-lg mb-6 border border-indigo-200 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 text-white"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <img src="/android-chrome-512x512.png" alt="Quiz Dangal" className="w-12 h-12 rounded-xl ring-2 ring-white/40" />
              <div>
                <div className="text-lg font-bold">Refer & Earn</div>
                <div className="text-sm opacity-90">Invite friends, they join — you earn referral rewards</div>
              </div>
            </div>
            <Button onClick={handleShareInvite} className="bg-white text-indigo-700 hover:bg-white/90">
              <Share2 className="w-4 h-4 mr-2" /> {sharing ? 'Sharing…' : '🚀 Invite & Earn'}
            </Button>
          </div>
          {showShareOptions && (
            <div className="mt-4 border-t border-white/30 pt-3">
              <div className="text-sm mb-2">Share via:</div>
              <div className="flex flex-wrap gap-2">
                {shareLinks.map((s) => (
                  <a key={s.name} href={s.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white/95 hover:bg-white">
                    <ExternalLink className="w-3.5 h-3.5" /> {s.name}
                  </a>
                ))}
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white/95 hover:bg-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div className="text-[11px] opacity-90 mt-2">Tip: Instagram direct share works best via the native share sheet on mobile.</div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
            <button disabled className="text-sm px-3 py-1.5 rounded-lg border bg-white text-gray-400 flex items-center" title="Coming soon">
              <Gift className="w-4 h-4 mr-1 text-yellow-600" /> Redeem Coins
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto"></div>
              <p className="text-gray-700 mt-2">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🪙</div>
              <p className="text-gray-800 font-medium">No activity yet — Start your first quiz and earn coins!</p>
              <p className="text-gray-500 text-sm mt-1">Your wallet will show quiz rewards, referrals and redeems here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg"
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
      {/* Refer & Earn section removed in Wallet per new design */}
      </motion.div>
    </div>
  );
};

export default Wallet;