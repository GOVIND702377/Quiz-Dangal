import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Flame, Sparkles } from 'lucide-react';
import StreakModal from '@/components/StreakModal';

const Header = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  // Use total_coins if available to keep display consistent with leaderboards
  const wallet = Number((userProfile?.total_coins ?? userProfile?.wallet_balance) || 0);

  const [streakModal, setStreakModal] = useState({ open: false, day: 0, coins: 0 });

  // Auto-claim daily streak once per day on first app open after login
  useEffect(() => {
    if (!user || !userProfile) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `qd_streak_last_claim_${user.id}`;
    try {
      const last = localStorage.getItem(key);
      if (last === today) return; // already claimed today
    } catch { }

    (async () => {
      try {
        const { data, error } = await supabase.rpc('handle_daily_login', { user_uuid: user.id });
        if (!error && data && (data.success || data.already_logged)) {
          try { localStorage.setItem(key, today); } catch { }
          const day = Number(data.streak_day || userProfile?.current_streak || 1);
          const coins = Number(data.coins_earned || Math.min(50, 10 + Math.max(0, day - 1) * 5));
          // Show popup only if this was a new claim
          if (data.success && data.is_new_login) {
            setStreakModal({ open: true, day, coins });
          }
          // Refresh profile to reflect new balances and streak
          await refreshUserProfile(user);
        }
      } catch {
        // silent; UI still works, user can try again later
      }
    })();
  }, [user, userProfile, refreshUserProfile]);

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      >
        {/* subtle gradient underline */}
        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40" />

        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src="/android-chrome-512x512.png"
                alt="Quiz Dangal Logo"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shadow-sm group-hover:scale-105 transition"
              />
              <div className="leading-tight whitespace-nowrap">
                <div className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:from-indigo-700 group-hover:to-purple-700 transition-colors">
                  Quiz Dangal
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 -mt-0.5">Where Minds Clash</div>
              </div>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Enhanced Coins indicator */}
              <Link
                to="/wallet"
                className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-full border text-xs md:text-sm text-gray-800 shadow-sm bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border-yellow-200 hover:from-yellow-100 hover:to-orange-100 transition"
                title="Coins Balance"
              >
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <Coins className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" />
                </motion.div>
                <span className="font-semibold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                  {wallet.toLocaleString()} coins
                </span>
              </Link>

              {/* Enhanced Streak Display */}
              <button
                type="button"
                onClick={() => {
                  const day = Number(userProfile?.current_streak || 0);
                  const coins = Math.min(50, 10 + Math.max(0, day - 1) * 5);
                  setStreakModal({ open: true, day, coins });
                }}
                className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-full border text-xs md:text-sm text-gray-800 shadow-sm bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border-amber-200 hover:from-orange-100 hover:to-yellow-100 transition"
                title="Daily Streak"
              >
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="relative"
                >
                  <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                  <Sparkles className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-0.5" />
                </motion.div>
                <span className="font-bold text-orange-700">Day {userProfile?.current_streak || 0}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav removed (navigation only in Footer) */}
      </motion.header>

      <StreakModal
        open={streakModal.open}
        onClose={() => setStreakModal((s) => ({ ...s, open: false }))}
        streakDay={streakModal.day}
        coinsEarned={streakModal.coins}
      />
    </>
  );
};

export default Header;
