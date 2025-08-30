import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Coins, Shield, Flame } from 'lucide-react';
import StreakChart from './StreakChart';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const Header = () => {
  const { user, userProfile, supabase, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';
  const wallet = Number(userProfile?.wallet_balance || 0);
  const streak = Number(userProfile?.streak_count || 0);

  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakClaiming, setStreakClaiming] = useState(false);

  const initials = (() => {
    const name = userProfile?.full_name || user?.email || '';
    const parts = name.split('@')[0].split(/[\s._-]+/).filter(Boolean);
    return (parts[0]?.[0] || 'U').toUpperCase();
  })();

  // Invite button removed; coins indicator + streak indicator added

  // Header se navigation hata diya gaya hai (nav links sirf footer me honge)

  // Daily streak: first visit per day auto-claim + coins bonus
  useEffect(() => {
    if (!user || streakClaiming || !supabase) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const key = `qd_streak_${user.id}_${yyyy}-${mm}-${dd}`;
    if (localStorage.getItem(key)) return;

    const claim = async () => {
      setStreakClaiming(true);
      try {
        const tryCalls = [
          () => supabase.rpc('update_streak', { p_user_id: user.id }),
          () => supabase.rpc('update_streak', { user_id: user.id }),
          () => supabase.rpc('update_streak', { user_uuid: user.id })
        ];
        let ok = false;
        for (const fn of tryCalls) {
          try {
            const { error } = await fn();
            if (!error) { ok = true; break; }
          } catch {}
        }
        if (!ok) {
          await supabase.from('transactions').insert([{ user_id: user.id, type: 'activity', amount: 0, status: 'ok', created_at: new Date().toISOString() }]);
        }
        localStorage.setItem(key, '1');
        setShowStreakPopup(true);
        await refreshUserProfile(user);
      } catch {
        // ignore
      } finally {
        setStreakClaiming(false);
      }
    };
    claim();
  }, [user, supabase]);

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

              {/* Streak Chart */}
              <StreakChart />

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

    {showStreakPopup && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-xl p-5 w-[90%] max-w-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mb-3">
            <Flame className="w-7 h-7 text-orange-500" />
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">Daily Streak + Coins!</div>
          <div className="text-sm text-gray-600 mb-4">Shabash! Aaj ka streak add ho gaya. Khelte raho, har din bonus milta rahega.</div>
          <button onClick={() => setShowStreakPopup(false)} className="inline-flex items-center justify-center w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">OK</button>
        </motion.div>
      </div>
    )}
    </>
  );
};

export default Header;
