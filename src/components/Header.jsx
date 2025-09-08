import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins, Flame, Sparkles } from 'lucide-react';
import StreakModal from '@/components/StreakModal';

const Header = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const wallet = Number(userProfile?.wallet_balance || 0);

  const [streakModal, setStreakModal] = useState({ open: false, day: 0, coins: 0 });
  const claimingRef = useRef(false);

  const getInitials = (name, email) => {
    if (name && name.trim()) {
      const nameParts = name.trim().split(' ');
      if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
      }
      return name.length > 0 ? name[0].toUpperCase() : '?';
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  // Auto-claim daily streak once per day on first app open after login
  useEffect(() => {
    // Only run if a user is logged in
    if (!user || claimingRef.current) return;

    const claimStreak = async () => {
      claimingRef.current = true;
      try {
        const { data, error } = await supabase.rpc('handle_daily_login', { user_uuid: user.id });

        if (error) {
          console.error('Error handling daily login:', error);
          return;
        }

        // The backend now tells us if it's a new login. Only show modal then.
        if (data && data.is_new_login) {
          // Refresh the user profile to get the new coin balance immediately
          await refreshUserProfile(user);
          // Show the popup with data directly from the RPC response
          setStreakModal({
            open: true,
            day: data.streak_day,
            coins: data.coins_earned,
          });
        }
      } catch (e) {
        console.error('Exception handling daily login:', e);
      } finally {
        claimingRef.current = false;
      }
    };

    // Use a small timeout to ensure the app has settled after login before claiming
    const timer = setTimeout(claimStreak, 1500);
    return () => clearTimeout(timer);

  }, [user, refreshUserProfile]);

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
                srcSet="/android-chrome-192x192.png 192w, /android-chrome-512x512.png 512w"
                sizes="(min-width: 640px) 48px, 44px"
                alt="Quiz Dangal Logo"
                width="48"
                height="48"
                decoding="async"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shadow-sm object-contain"
                style={{ imageRendering: 'auto' }}
              />
              <div className="leading-tight whitespace-nowrap">
                <div className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:from-indigo-700 group-hover:to-purple-700 transition-colors">
                  Quiz Dangal
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 -mt-0.5">Where Minds Clash</div>
              </div>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Coins indicator */}
              <Link
                to="/wallet"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/50 border border-amber-200/80 text-amber-800 shadow-sm hover:bg-amber-100/80 transition-colors"
                title="Coins Balance"
              >
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <Coins className="w-5 h-5 text-yellow-500" />
                </motion.div>
                <span className="font-bold text-sm">
                  {wallet.toLocaleString()}
                </span>
              </Link>

              {/* Streak Display */}
              <button
                type="button"
                onClick={() => {
                  const day = Number(userProfile?.current_streak || 0);
                  const coins = Math.min(50, 10 + Math.max(0, day - 1) * 5);
                  setStreakModal({ open: true, day, coins });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100/50 border border-orange-200/80 text-orange-800 shadow-sm hover:bg-orange-100/80 transition-colors"
                title="Daily Streak"
              >
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                >
                  <Flame className="w-5 h-5 text-orange-500" />
                </motion.div>
                <span className="font-bold text-sm">{userProfile?.current_streak || 0}</span>
              </button>

              {/* Profile Avatar */}
              <Link to="/profile" className="block">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-indigo-200 to-purple-200 flex items-center justify-center ring-2 ring-white/80 shadow-md hover:ring-purple-300 transition-all">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="User Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-indigo-700">{getInitials(userProfile?.full_name, user?.email)}</span>
                  )}
                </div>
              </Link>
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