import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Coins, Shield } from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const Header = () => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';
  const wallet = Number(userProfile?.wallet_balance || 0);

  const initials = (() => {
    const name = userProfile?.full_name || user?.email || '';
    const parts = name.split('@')[0].split(/[\s._-]+/).filter(Boolean);
    return (parts[0]?.[0] || 'U').toUpperCase();
  })();

  // Invite button removed; coins indicator added instead

  // Header se navigation hata diya gaya hai (nav links sirf footer me honge)

  return (
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
            <div className="leading-tight">
              <div className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Quiz Dangal
              </div>
              <div className="text-[10px] sm:text-[11px] text-gray-500 -mt-0.5">Play • Win • Redeem</div>
            </div>
          </Link>

          {/* Nav (desktop) intentionally removed */}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Coins indicator */}
            <Link
              to="/wallet"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/70 border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
              title="Coins Balance"
            >
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">{wallet.toLocaleString()} coins</span>
            </Link>

            {/* Invite removed as per UI update */}

            {/* Admin shortcut */}
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-red-600 border border-red-200 bg-white/70 hover:bg-red-50"
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
  );
};

export default Header;
