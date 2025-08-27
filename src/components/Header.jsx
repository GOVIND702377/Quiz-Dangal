import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Share2, Shield } from 'lucide-react';

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

  const handleInvite = async () => {
    try {
      const code = userProfile?.referral_code || user?.id;
      const shareUrl = `${window.location.origin}?ref=${encodeURIComponent(code)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied', description: 'Referral link copied to clipboard' });
      } else {
        window.prompt('Copy your referral link:', shareUrl);
      }
    } catch (e) {
      toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
    }
  };

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
            {/* Wallet pill removed (moved to footer navigation) */}

            {/* Invite */}
            <button
              onClick={handleInvite}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow"
            >
              <Share2 className="w-4 h-4" /> Invite
            </button>

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
