// Clean rebuilt Home.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { smartJoinQuiz } from '@/lib/smartJoinQuiz';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MessageSquare, Brain, Trophy, Clapperboard } from 'lucide-react';
import StreakModal from '@/components/StreakModal';
// Modal removed; navigate to a dedicated page instead

// Use same count and names as existing app (styled like the screenshot)
const HOME_TILES = [
  { title: 'Opinion', slug: 'opinion', icon: MessageSquare },
  { title: 'G.K Knowledge', slug: 'gk', icon: Brain },
  { title: 'Sports', slug: 'sports', icon: Trophy },
  { title: 'Movies', slug: 'movies', icon: Clapperboard },
];

const HOME_FAQ_ENTRIES = [
  {
    question: 'What is Quiz Dangal?',
    answer: 'Quiz Dangal is India\'s daily quiz arena where you play opinion and knowledge rounds, earn coins, and climb leaderboards with friends.'
  },
  {
    question: 'How can new pages get indexed quickly?',
    answer: 'Submit https://quizdangal.com/sitemap.xml in Google Search Console, request indexing for key URLs, and keep internal links pointing to every new landing page.'
  },
  {
    question: 'Does Quiz Dangal support the Google Play-style “Play & Win” format?',
    answer: 'Yes. Our Play & Win quizzes run daily with live leaderboards, transparent scoring, and instant rewards for top performers.'
  }
];

const HOME_FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQ_ENTRIES.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

const HOME_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Quiz Dangal',
    alternateName: ['QuizDangal', 'Quiz Dangal', 'QuizDangl'],
    url: 'https://quizdangal.com/',
    logo: 'https://quizdangal.com/android-chrome-512x512.png',
    sameAs: [
      'https://www.instagram.com/quizdangal',
      'https://www.facebook.com/profile.php?id=61576614092243',
      'https://x.com/quizdangal',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@quizdangal.com',
        availableLanguage: ['Hindi', 'English'],
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Quiz Dangal',
    url: 'https://quizdangal.com/',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://quizdangal.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Quiz Dangal',
    url: 'https://quizdangal.com/',
    applicationCategory: 'Game',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: 'Play & Win Quiz App',
    url: 'https://quizdangal.com/play-win-quiz-app/',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: 'Opinion Quiz App',
    url: 'https://quizdangal.com/opinion-quiz-app/',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: 'Leaderboards',
    url: 'https://quizdangal.com/leaderboards/',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: 'Refer & Earn',
    url: 'https://quizdangal.com/refer-earn-quiz-app/',
  },
  HOME_FAQ_SCHEMA,
];

// (Removed duplicate streak badge & user header area as per request)

// Gradients removed for minimal solid theme

// Removed unused accentFor and vividFor helpers
const Tile = ({ tile, quizzes, index, navigateTo }) => {
  // pick active or upcoming by TIME (ignore possibly stale status)
  const now = Date.now();
  // Filter & sort only for existence side-effects (result not stored)
  quizzes
    .filter(q => (q.category || '').toLowerCase() === tile.slug.toLowerCase())
    .filter(q => {
      const st = q.start_time ? new Date(q.start_time).getTime() : 0;
      const et = q.end_time ? new Date(q.end_time).getTime() : 0;
      const isActive = st && et && now >= st && now < et;
      const isUpcoming = st && now < st;
      return isActive || isUpcoming;
    })
    .sort((a,b) => new Date(a.start_time || a.end_time || 0) - new Date(b.start_time || b.end_time || 0));
  // removed quiz/totalCount/isLoading (simplified tile)
  const Icon = tile.icon;
  const variants = ['neon-orange', 'neon-purple', 'neon-teal', 'neon-pink'];
  // Palette for badge per tile
  // removed palettes array
  // Always show PLAY instead of SOON/other states (as requested)
  const label = 'PLAY';
  const animationDelay = `${index * 80}ms`;
  return (
    <button
      type="button"
      // Click sound handled globally via SoundProvider pointerdown listener
      onClick={() => navigateTo(tile.slug)}
      className={`neon-card ${variants[index % variants.length]} group aspect-square w-full rounded-xl focus:outline-none transform-gpu transition-transform hover:scale-[1.02] hover:shadow-xl relative animate-fade-scale`}
      style={{ borderRadius: '0.75rem', '--fade-scale-delay': animationDelay }}
      aria-label={`${tile.title} - Play`}
    >
      {/* Removed count badge per request */}
      <div className="neon-card-content select-none flex items-center justify-center">
        <div className="w-full flex flex-col items-center justify-center gap-2">
          <Icon className="w-8 h-8 text-white drop-shadow" />
          <h3 className="text-base font-extrabold leading-tight text-white text-shadow-sm text-center">
            {tile.title}
          </h3>
          <span className="play-pill group-hover:shadow-lg group-hover:brightness-110">{label}</span>
        </div>
      </div>
    </button>
  );
};

const Home = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streakModal, setStreakModal] = useState({ open: false, day: 0, coins: 0 });
  // removed claimingRef (unused)
  const [joiningId, setJoiningId] = useState(null);
  // Removed list modal state

  const fetchQuizzesAndCounts = useCallback(async () => {
    try {
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('id,title,category,start_time,end_time,status,prize_pool,prizes,prize_type')
        .order('start_time', { ascending: true });
      if (error) throw error;
      setQuizzes(quizzesData || []);
    }
    catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not fetch quizzes.', variant: 'destructive' }); setQuizzes([]); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    let intervalId = null;

    const kickoff = async () => {
      if (cancelled) return;
      await fetchQuizzesAndCounts();
      if (cancelled) return;
      intervalId = window.setInterval(fetchQuizzesAndCounts, 60000);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(kickoff, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(kickoff, 120);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [fetchQuizzesAndCounts]);

  // Daily login claim handled in Header; avoid duplicate RPC here

  const handleJoinQuiz = async (quiz) => {
    if (!quiz || joiningId === quiz.id) return;
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to join the quiz.', variant: 'destructive' });
      navigate('/login');
      return;
    }
    setJoiningId(quiz.id);
    try {
      const result = await smartJoinQuiz({ supabase, quiz, user });
      if (result.status === 'error') throw result.error;
      if (result.status === 'already') {
        toast({ title: 'Already Joined', description: 'You are in this quiz.' });
        navigate(`/quiz/${quiz.id}`);
      } else if (result.status === 'joined') {
        toast({ title: 'Joined!', description: 'Redirecting you to the quiz.' });
        navigate(`/quiz/${quiz.id}`);
      } else if (result.status === 'pre_joined') {
        toast({ title: 'Pre-joined!', description: 'We will remind you 1 minute before start.' });
      } else if (result.status === 'scheduled_retry') {
        toast({ title: 'Pre-joined!', description: 'Auto joining at start boundary.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Could not join quiz.', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  return (
  <div className="relative pt-1 sm:pt-12 md:pt-14">
            <SEO
        title="Quiz Dangal – Play Quiz & Win Rewards | Opinion, GK, Sports, Movies"
        description="Quiz Dangal is India’s play-and-win quiz arena. Take opinion and GK quizzes daily, grow streaks, invite friends, and redeem coins for rewards."
        canonical="https://quizdangal.com/"
        keywords={[
          'Quiz Dangal','quizdangal','quiz app','play quiz and win','opinion quiz','daily quiz india','refer and earn quiz','win rewards','leaderboards','online quiz contest'
        ]}
        alternateLocales={['hi_IN', 'en_US']}
        jsonLd={HOME_JSON_LD}
      />
      <div className="relative z-10 min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-2">
        <div className="w-full max-w-[420px]">
          {/* Intro header above categories */}
          <div
            className="text-center mb-2 animate-fade-up"
            style={{ '--fade-delay': '60ms' }}
          >
            {/* Hide original content per request */}
            <div className="hidden">
              <span className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80 bg-indigo-500/15 border border-indigo-400/30 rounded-full">
                Quiz Dangal Official
              </span>
                <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">
                  <span className="italic">Brain Games. Real Gains.</span>
                </h1>
                <p className="text-sm text-slate-200 mt-1">
                  <span className="italic">Compete, earn, repeat — shine every round.</span>
                </p>
              <ul className="mt-3 text-[12px] text-slate-300/90 space-y-1 text-left">
                <li>• Transparent scoring with instant leaderboards</li>
                <li>• Refer &amp; earn bonuses when friends join your squad</li>
                <li>• Daily streaks, reminders, and progressive rewards</li>
              </ul>
              <div className="mx-auto mt-2 h-[2px] w-24 rounded-full bg-gradient-to-r from-indigo-400/60 via-fuchsia-400/60 to-pink-400/60" />
            </div>
            {/* Replacement hero copy */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-snug text-white">
                <span className="italic">Brain Games. Real Gains.</span>
              </h1>
              <p className="mt-0 text-sm sm:text-base font-medium text-slate-200">
                <span className="italic">Compete, earn, repeat — shine every round.</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square w-full rounded-xl bg-slate-800/60 border border-slate-700/60 animate-pulse" />
              ))
              : HOME_TILES.map((t, i) => (
                <Tile
                  key={t.slug}
                  tile={t}
                  quizzes={quizzes}
                  onJoin={handleJoinQuiz}
                  index={i}
                  joiningId={joiningId}
                  navigateTo={(slug) => navigate(`/category/${slug}/`)}
                />
              ))}
          </div>
          {/* Hidden FAQs per request (kept in DOM for future use) */}
          <div className="hidden mt-6 text-left bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">Quiz Dangal FAQs</h2>
            {HOME_FAQ_ENTRIES.map((item) => (
              <div key={item.question}>
                <p className="text-[13px] font-semibold text-indigo-200/90">{item.question}</p>
                <p className="text-[12px] text-slate-300/85 mt-1">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
  <StreakModal open={streakModal.open} day={streakModal.day} coins={streakModal.coins} onClose={() => setStreakModal(s => ({ ...s, open: false }))} />
      {/* Category modal removed in favor of page navigation */}
    </div>
  );
};

export default Home;
