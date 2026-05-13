// Quiz Dangal – Home (premium redesign)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SeoHead from '@/components/SEO';
import { BUILD_DATE } from '@/constants';
import { useNavigate, Link } from 'react-router-dom';
import {
  Brain,
  ChevronRight,
  Film,
  Coins,
  Flame,
  MessageCircle,
  Newspaper,
  Trophy,
  User,
} from 'lucide-react';
import { getSupabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import StreakModal from '@/components/StreakModal';
import { prefetchRoute } from '@/lib/utils';
import { prefetchSlotData } from '@/lib/slots';

/* ─── tiny static data ─── */
const QUICK_ARENAS = [
  {
    id: 'gk',
    title: 'Brain Dangal',
    subtitle: 'GK & Trivia',
    Icon: Brain,
    bg: 'from-violet-600 to-fuchsia-700',
    ring: 'ring-1 ring-fuchsia-500/30',
    shadow: 'shadow-[0_10px_40px_rgba(192,38,211,0.25)]'
  },
  {
    id: 'opinion',
    title: 'Opinion Wars',
    subtitle: 'Share views',
    Icon: MessageCircle,
    bg: 'from-emerald-500 to-teal-700',
    ring: 'ring-1 ring-teal-500/30',
    shadow: 'shadow-[0_10px_40px_rgba(20,184,166,0.25)]'
  },
  {
    id: 'gk',
    title: 'Daily Clash',
    subtitle: 'Current Affairs',
    Icon: Newspaper,
    bg: 'from-blue-600 to-indigo-800',
    ring: 'ring-1 ring-indigo-500/30',
    shadow: 'shadow-[0_10px_40px_rgba(79,70,229,0.25)]'
  },
  {
    id: 'gk',
    title: 'Bollywood',
    subtitle: 'Movie Magic',
    Icon: Film,
    bg: 'from-rose-500 to-pink-700',
    ring: 'ring-1 ring-pink-500/30',
    shadow: 'shadow-[0_10px_40px_rgba(236,72,153,0.25)]'
  }
];

const shouldSkipStartupPrefetch = () => {
  if (typeof window === 'undefined') return true;
  try {
    const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    return (
      isCoarse
      || saveData
      || effectiveType === 'slow-2g'
      || effectiveType === '2g'
      || effectiveType === '3g'
    );
  } catch {
    return true;
  }
};

const Home = () => {
  const navigate = useNavigate();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [modal, setModal] = useState({ open: false, day: 0, coins: 0 });

  const coins = useMemo(() => Number(userProfile?.wallet_balance || 0), [userProfile?.wallet_balance]);
  const streak = useMemo(() => Number(userProfile?.current_streak || 0), [userProfile?.current_streak]);
  const nextStreakReward = useMemo(
    () => streak === 0 ? 0 : Math.min(25, 10 + Math.max(0, streak - 1) * 5),
    [streak]
  );

  const displayName = useMemo(() => {
    const raw = userProfile?.full_name || userProfile?.name || user?.email || '';
    const s = String(raw || '').trim();
    if (!s) return 'Player';
    const first = s.split(/\s+/)[0];
    return first.length > 14 ? `${first.slice(0, 14)}…` : first;
  }, [userProfile?.full_name, userProfile?.name, user?.email]);

  // Memoize skip check — same result on every mount, no need to call twice
  const skipPrefetch = useMemo(() => shouldSkipStartupPrefetch(), []);

  // Show streak modal — AuthContext claims the streak after profile upsert.
  // We listen for the qd:streak CustomEvent dispatched from AuthContext.
  useEffect(() => {
    const onStreak = (e) => {
      const { streak_day, coins_earned } = e.detail || {};
      if (streak_day && coins_earned) {
        refreshUserProfile(user);
        setModal({ open: true, day: streak_day, coins: coins_earned });
      }
    };
    window.addEventListener('qd:streak', onStreak);
    return () => window.removeEventListener('qd:streak', onStreak);
  }, [user, refreshUserProfile]);

  // Warm Supabase in background on Home mount so it's ready when user taps a category
  useEffect(() => {
    if (skipPrefetch) return;
    const timeoutId = window.setTimeout(() => {
      getSupabase().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [skipPrefetch]);

  useEffect(() => {
    if (skipPrefetch) return;

    let timeoutId = null;
    let idleId = null;
    let started = false;

    const warmRoutes = () => {
      prefetchRoute('/category/opinion');
      prefetchRoute('/category/gk');
    };

    const startWarmup = () => {
      if (started) return;
      started = true;
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(warmRoutes, { timeout: 2200 });
      } else {
        timeoutId = window.setTimeout(warmRoutes, 900);
      }
    };

    window.addEventListener('pointerdown', startWarmup, { once: true, passive: true });
    window.addEventListener('touchstart', startWarmup, { once: true, passive: true });
    window.addEventListener('keydown', startWarmup, { once: true });

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener('pointerdown', startWarmup);
      window.removeEventListener('touchstart', startWarmup);
      window.removeEventListener('keydown', startWarmup);
    };
  }, [skipPrefetch]);

  const go = useCallback((id) => {
    prefetchSlotData(id);
    navigate(`/category/${id}/`);
  }, [navigate]);

  const warmCategory = useCallback((id) => {
    prefetchRoute(`/category/${id}`);
    prefetchSlotData(id);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[520px] px-0 pb-[calc(var(--qd-footer-h)+24px)] sm:px-4 md:max-w-[780px] md:px-8 lg:max-w-[860px] lg:px-12 xl:max-w-[920px] xl:px-16">
      <SeoHead
        title="Quiz Dangal - Daily Opinion & GK Quiz for IPL Fans"
        description="Play daily opinion polls, IPL season trivia, current affairs, and GK quizzes on Quiz Dangal. Win coins, climb leaderboards, and join fresh live rounds every day."
        canonical="https://quizdangal.com/"
        datePublished="2025-01-15"
        dateModified={BUILD_DATE}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Quiz Dangal', url: 'https://quizdangal.com/' },
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Quiz Dangal',
            operatingSystem: 'Web, Android, iOS',
            applicationCategory: 'GameApplication',
            applicationSubCategory: 'Trivia',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
            aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', ratingCount: '1240', bestRating: '5', worstRating: '1' },
            description: 'Play daily opinion polls, GK quizzes, and current affairs rounds. Earn coins, climb leaderboards, and compete with players across India — 100% free.',
            url: 'https://quizdangal.com/',
            image: 'https://quizdangal.com/android-chrome-512x512.png',
            author: { '@type': 'Organization', name: 'Quiz Dangal', url: 'https://quizdangal.com/' },
            inLanguage: ['en', 'hi'],
          },
        ]}
      />

      {/* ═══════ FLOATING HEADER ═══════ */}
      <header className="sticky top-0 z-50 mx-0 mt-0 mb-2 px-2 py-3 sm:top-3 sm:mx-2 sm:mt-3 sm:mb-4 sm:px-4 sm:py-3 rounded-none sm:rounded-2xl bg-[#090412]/90 backdrop-blur-xl border-b border-white/10 sm:border shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-2 w-full">
          <Link to="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <img
              src="/logo-48.png"
              alt="Quiz Dangal"
              width={44}
              height={44}
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority="high"
              className="h-11 w-11 sm:h-10 sm:w-10 rounded-[12px] transition-transform duration-300 group-hover:scale-[1.05]"
            />
            <div className="text-[1.35rem] md:text-[1.55rem] font-black tracking-tight bg-gradient-to-r from-violet-200 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
              Quiz Dangal
            </div>
          </Link>

          {user ? (
            <div className="ml-auto flex items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await refreshUserProfile(user);
                  setModal({
                    open: true,
                    day: streak,
                    coins: nextStreakReward
                  });
                }}
                className="home-shine flex items-center gap-1.5 rounded-full px-2.5 py-2 sm:px-3.5 sm:py-2 text-sm sm:text-sm md:text-base font-extrabold border border-orange-500/30 bg-gradient-to-br from-orange-600 to-red-700 shadow-[0_4px_15px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.05] active:scale-95"
                aria-label="Open streak rewards"
              >
                <Flame size={14} className="text-amber-200" />
                <span className="text-white drop-shadow-md">{streak}</span>
              </button>
              <Link
                to="/wallet/"
                className="home-shine flex items-center gap-1.5 rounded-full px-2.5 py-2 sm:px-3.5 sm:py-2 text-sm sm:text-sm md:text-base font-extrabold border border-violet-400/30 bg-gradient-to-br from-indigo-600 to-purple-700 shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.05] active:scale-95"
                aria-label="Open wallet"
              >
                <Coins size={14} className="text-yellow-300" />
                <span className="text-white drop-shadow-md">{coins.toLocaleString()}</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login/"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 sm:px-5 sm:py-2.5 text-sm sm:text-sm md:text-base font-bold border border-violet-500/50 bg-violet-600/20 hover:bg-violet-600/40 text-violet-100 transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] shrink-0"
            >
              <User size={14} className="text-violet-300" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      <div className="pt-0 space-y-5 px-0">

        {/* ======= IPL DANGAL HERO BANNER ======= */}
        <section className="animate-fade-up px-0" style={{ '--fade-delay': '0ms' }}>

          <div className="mb-2 px-4 sm:px-0">
            <h1 className="flex items-center gap-2 text-[1.4rem] sm:text-[1.6rem] font-black tracking-tight">
              <span className="text-white">Hey!</span>
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => go('opinion')}
            onPointerEnter={() => warmCategory('opinion')}
            className="group relative block w-full overflow-hidden rounded-[28px] sm:rounded-[32px] text-center border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.85)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_72px_rgba(249,115,22,0.45)] hover:border-orange-500/40 ipl-hero-btn"
            style={{ background: 'linear-gradient(135deg,#0c0005 0%,#180612 40%,#0f0308 70%,#060010 100%)' }}
            aria-label="Play IPL Dangal opinion quiz"
          >
            {/* Top shimmer line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

            {/* Background orbs */}
            <div className="ipl-orb ipl-orb-1" />
            <div className="ipl-orb ipl-orb-2" />
            <div className="ipl-orb ipl-orb-3" />

            {/* Subtle diagonal grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '28px 28px' }}
            />

            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#060010] to-transparent" />

            {/* Main content */}
            <div className="relative z-10 flex min-h-[220px] sm:min-h-[270px] md:min-h-[320px] flex-row items-center justify-between gap-4 md:gap-10 px-5 py-7 sm:px-10 md:px-14">

              {/* Left: Text */}
              <div className="flex flex-col items-start text-left">
                {/* LIVE badge */}
                <div className="mb-3 self-start inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-4 py-1.5 backdrop-blur-sm">
                  <span className="ipl-live-dot" />
                  <span className="text-[0.6rem] sm:text-[0.65rem] font-black uppercase tracking-[0.3em] text-red-300">Live Season</span>
                  <span className="ipl-live-dot" />
                </div>

                {/* Season label */}
                <div className="mb-1 text-[0.7rem] sm:text-[0.75rem] font-black uppercase tracking-[0.35em] text-orange-400/80">
                  IPL 2026
                </div>

                {/* Main title */}
                <div className="ipl-banner-title mb-4">
                  IPL<br className="hidden sm:block md:hidden" /> DANGAL
                </div>

                {/* Tagline */}
                <p className="mb-5 text-[0.72rem] sm:text-[0.8rem] text-white/55 font-medium leading-relaxed max-w-[200px] sm:max-w-[260px] md:max-w-[300px]">
                  Predict. Compete. Win coins on every match.
                </p>

                {/* CTA button */}
                <div className="ipl-cta-wrap">
                  <div className="ipl-cta-btn" aria-hidden="true">
                    <Trophy size={13} className="ipl-cta-trophy" strokeWidth={2.5} />
                    <span className="ipl-cta-label">PLAY NOW</span>
                    <span className="ipl-cta-arrow-icon">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Emblem (desktop only) */}
              <div className="flex ipl-emblem-wrap" aria-hidden="true">
                <div className="ipl-emblem-halo" />
                <div className="ipl-emblem-ring ipl-emblem-ring-outer" />
                <div className="ipl-emblem-ring ipl-emblem-ring-mid" />
                <div className="ipl-emblem-ring ipl-emblem-ring-inner" />
                <div className="ipl-emblem-core">
                  <img
                    src="/logo-48.png"
                    alt=""
                    width={72}
                    height={72}
                    className="ipl-emblem-logo"
                    draggable="false"
                  />
                </div>
              </div>

              {/* Spacer on mobile so emblem shows */}
            </div>

            {/* Bottom shimmer */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          </button>
        </section>

        {/* ═══════ QUICK ARENAS (Premium Refined 2x2 Grid) ═══════ */}
        <section className="animate-fade-up px-0" style={{ '--fade-delay': '100ms' }}>
          <div className="flex items-center mb-4 px-4 sm:px-0">
            <h2 className="text-[1rem] sm:text-[0.95rem] font-black text-white/90 tracking-widest uppercase">Quick Arenas</h2>
          </div>

          {/* Mobile: horizontal scroll | Desktop: 4-col grid */}
          <div className="qa-scroll-track">
            {QUICK_ARENAS.map(({ id, Icon, title, subtitle, bg, ring, shadow }) => (
              <button
                key={title}
                type="button"
                onClick={() => go(id)}
                onPointerEnter={() => warmCategory(id)}
                className={`qa-card group bg-gradient-to-br ${bg} ${ring} ${shadow}`}
                aria-label={`Play ${title}: ${subtitle}`}
              >
                {/* Radial shine */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.13),transparent_65%)]" />
                <Icon className="absolute -right-3 -bottom-3 h-20 w-20 text-white opacity-[0.18] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none" aria-hidden="true" strokeWidth={1.5} />

                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon pill */}
                  <div className="qa-icon-pill mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Icon size={22} aria-hidden="true" strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 className="text-[1rem] sm:text-[1.05rem] font-black text-white leading-tight drop-shadow-md">{title}</h3>
                    <p className="text-[0.6rem] font-bold text-white/70 mt-0.5 tracking-widest uppercase">{subtitle}</p>
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <span className="text-[0.6rem] font-black uppercase tracking-widest text-white/80">Play</span>
                    <div className="qa-arrow-btn transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-0.5">
                      <ChevronRight size={14} className="text-white" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

      </div>

      <StreakModal
        open={modal.open}
        onClose={() => setModal(s => ({ ...s, open: false }))}
        streakDay={modal.day}
        coinsEarned={modal.coins}
      />
    </div>
  );
};

export default Home;