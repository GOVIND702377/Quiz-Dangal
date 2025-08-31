import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Coins, Shield, Flame } from 'lucide-react';

const Header = () => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const wallet = Number(userProfile?.wallet_balance || 0);

  // Invite button removed; coins indicator + streak indicator added

  // Header se navigation hata diya gaya hai (nav links sirf footer me honge)

  // Remove old streak system - now handled by OnboardingFlow

  return (
    <>
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.05)]"
    >
      {/* subtle gradient underline */}
      <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40" />

      <div className="container mx-auto px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
      <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/android-chrome-512x512.png"
              alt="Quiz Dangal Logo"
        className="w-10 h-10 rounded-xl shadow-sm group-hover:scale-105 transition"
            />
            <div className="leading-tight whitespace-nowrap">
        <div className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:from-indigo-700 group-hover:to-purple-700 transition-colors">
                Quiz Dangal
              </div>
        <div className="text-[10px] sm:text-[11px] text-gray-500 -mt-0.5">Where Minds Clash</div>
            </div>
          </Link>

          {/* Nav (desktop) intentionally removed */}

          {/* Actions */}
      <div className="flex items-center gap-2">
            {/* Coins indicator */}
            <Link
              to="/wallet"
        className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border bg-white/70 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/60 text-xs md:text-sm text-gray-700 shadow-sm"
              title="Coins Balance"
            >
        <Coins className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" />
        <span className="font-semibold">{wallet.toLocaleString()} coins</span>
            </Link>

              {/* Simple Streak Display */}
              <div className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border bg-white/70 border-gray-200 text-xs md:text-sm text-gray-700 shadow-sm">
                <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                <span className="font-semibold">Day {userProfile?.current_streak || 0}</span>
              </div>

            {/* Invite removed as per UI update */}

            {/* Admin shortcut */}
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-red-600 border border-red-200 bg-white/70 hover:bg-red-50 shadow-sm"
                title="Admin Panel"
              >
                <Shield className="w-4 h-4" /> Admin
              </Link>
            )}

            {/* Profile avatar removed (access via footer navigation) */}
          </div>
        </div>
      </div>

  {/* Mobile nav removed (navigation only in Footer) */}
    </motion.header>

    {/* Streak popup removed - now handled by OnboardingFlow */}
    </>
  );
};

export default Header;
