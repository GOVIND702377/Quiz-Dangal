import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Share2, Copy, Check, ExternalLink, Gift } from 'lucide-react';

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
            <div className="flex items-center gap-3 min-w-[230px] flex-1">
              <motion.div
                animate={bouncing ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative bg-gradient-to-r from-yellow-400 to-amber-500 p-3 rounded-full shadow-[0_0_14px_rgba(245,158,11,0.45)] -mt-1"
                aria-hidden
              >
                <Coins size={22} className="text-white drop-shadow" />
                <motion.span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  initial={{ opacity: 0.25 }}
                  animate={{ opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  style={{ boxShadow: '0 0 18px 4px rgba(245,158,11,0.3)' }}
                />
              </motion.div>
              <div>
                <div className="text-xs font-medium text-gray-700 tracking-wide">Coins Balance</div>
                <div className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-500 leading-tight">
                  {walletBalance.toLocaleString()} coins
                </div>
                <motion.div
                  className="text-xs md:text-sm text-gray-700"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  Your wallet is waiting to be filled 💸
                </motion.div>
              </div>
            </div>
            {/* Redeem moved to right side */}
            <div className="ml-auto self-start">
              <Link
                to="/redemptions"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-[1.015] active:scale-100 transition focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <Gift className="w-4 h-4" />
                <span className="font-semibold tracking-wide">Redeem Coins</span>
              </Link>
            </div>
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
            <Button onClick={handleShareInvite} className="bg-white text-indigo-700 hover:bg-white/90 px-2.5 py-1.5 text-sm">
              <Share2 className="w-4 h-4 mr-2" /> {sharing ? 'Sharing…' : 'Invite & Earn'}
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
    </div>
  );
};

export default Wallet;