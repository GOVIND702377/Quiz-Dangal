import React, { useEffect, useState, useRef, useMemo } from 'react';
import { STREAK_CLAIM_DELAY_MS } from '@/constants';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Coins } from 'lucide-react';
import StreakModal from '@/components/StreakModal';
// sound controls removed per requirement: keep header clean

const Header = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const wallet = useMemo(() => Number(userProfile?.wallet_balance || 0), [userProfile?.wallet_balance]);
  const walletLabel = useMemo(() => wallet.toLocaleString(), [wallet]);

  // Download logic removed

  const [streakModal, setStreakModal] = useState({ open: false, day: 0, coins: 0 });
  const claimingRef = useRef(false);
  const streak = useMemo(() => Number(userProfile?.current_streak || 0), [userProfile?.current_streak]);

  // Removed getInitials helper (unused)

  // Auto-claim daily streak once per day on first app open after login
  useEffect(() => {
    // Only run if a user is logged in
    if (!user || claimingRef.current) return;

    const claimStreak = async () => {
      claimingRef.current = true;
      try {
        // Prevent duplicate claims within the same day per session (handles accidental reloads)
        const key = `qd_streak_claim_${user.id}`;
        const today = new Date();
        const stamp = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
        try {
          const last = sessionStorage.getItem(key);
          if (last === stamp) return; // already claimed today in this session
        } catch (e) { /* sessionStorage read fail */ }

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

        // Mark as claimed for today in this session
  try { sessionStorage.setItem(key, stamp); } catch (e) { /* sessionStorage write fail */ }
      } catch (e) {
        console.error('Exception handling daily login:', e);
      } finally {
        claimingRef.current = false;
      }
    };

    // Use a small timeout to ensure the app has settled after login before claiming
  const timer = setTimeout(claimStreak, STREAK_CLAIM_DELAY_MS);
    return () => clearTimeout(timer);

  }, [user, refreshUserProfile]);

  // Removed handleDownload (unused)

  return (
    <>
      <header
        className="sticky top-0 z-[60] px-2 pt-2 animate-slide-down"
        data-mute-click-sound
        style={{ '--slide-delay': '40ms' }}
      >
        <div className="qd-card rounded-3xl overflow-hidden">

  <div className="container mx-auto px-2 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src="/logo.svg"
                alt="Quiz Dangal Logo"
                width="48"
                height="48"
                decoding="async"
                onError={(e) => { e.currentTarget.src = '/android-chrome-512x512.png'; }}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg object-contain select-none"
                draggable="false"
                style={{ imageRendering: 'auto' }}
              />
              <div className="leading-tight whitespace-nowrap select-none">
                <div className="text-xl sm:text-2xl font-extrabold qd-gradient-text drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] tracking-tight">
                  Quiz Dangal
                </div>
                <div className="text-[11px] sm:text-xs text-white/70 -mt-0.5 font-medium">Where Minds Clash</div>
              </div>
            </Link>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3 translate-x-1 sm:translate-x-0">
              {/* Download button (shown only if configured) */}
              {/* Download chip removed; use floating FAB instead */}
              {/* Unified Coin Badge */}
              <div className="hidden sm:inline-flex hd-badge hd-badge-gold" title="Coins" aria-label={`Coins: ${walletLabel}`}>
                <div className="hd-badge-icon" aria-hidden="true">
                  <div className="hd-badge-coin">
                    <div className="hd-badge-coin-front">
                      <Coins className="hd-badge-coin-icon" />
                      <span className="hd-badge-coin-shine" />
                    </div>
                  </div>
                </div>
                <div className="hd-badge-info select-none">
                  <span className="hd-badge-value tabular-nums">{walletLabel}</span>
                  <span className="hd-badge-label">COINS</span>
                </div>
              </div>
              {/* Streak Badge (inline flame emoji, removed separate FlameIcon component) */}
              <button
                type="button"
                onClick={() => {
                  const day = streak;
                  const coins = Math.min(50, 10 + Math.max(0, day - 1) * 5);
                  setStreakModal({ open: true, day, coins });
                }}
                className="hd-badge hd-badge-streak -ml-1 sm:-ml-2"
                title="Daily Streak"
                aria-label={`Streak: ${streak} days`}
              >
                <div className="hd-badge-icon hd-badge-icon-streak-full" aria-hidden="true">
                  <div className="streak-orb" />
                  <span className="streak-emoji" style={{fontSize:'20px',lineHeight:1,filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.55)) drop-shadow(0 0 4px rgba(255,150,40,0.5))'}}>🔥</span>
                </div>
                <div className="hd-badge-info select-none">
                  <span className="hd-badge-value tabular-nums">{streak}</span>
                  <span className="hd-badge-label">STREAK</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        </div>
      </header>

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