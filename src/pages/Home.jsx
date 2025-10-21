// Clean rebuilt Home.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
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
      // Allow pre-join if upcoming; otherwise normal join
      const rpc = quiz.status === 'upcoming' ? 'pre_join_quiz' : 'join_quiz';
      const { data, error } = await supabase.rpc(rpc, { p_quiz_id: quiz.id });
      if (error) throw error;
      if (quiz.status === 'upcoming') {
        toast({ title: 'Pre-joined!', description: 'We will remind you 1 minute before start.' });
      } else {
        if (data && data !== 'Joined Successfully') throw new Error(data);
        toast({ title: 'Joined!', description: 'Redirecting you to the quiz.' });
        navigate(`/quiz/${quiz.id}`);
      }
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      let description = err?.message || 'Could not join quiz.';
      let title = 'Error';
      if (msg.includes('not authenticated')) {
        title = 'Login required';
        description = 'Please sign in to join the quiz.';
      } else if (msg.includes('insufficient balance')) {
        title = 'Insufficient balance';
        description = 'You do not have enough coins to join this quiz.';
      } else if (msg.includes('quiz not active')) {
        title = 'Quiz not active';
        description = 'This quiz is not active right now.';
      }
      toast({ title, description, variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="h-full relative overflow-hidden">
      <SEO
        title="Quiz Dangal – Play Quiz & Win Rewards | Opinion, GK, Sports, Movies"
        description="Play daily opinion-based quizzes on Quiz Dangal. Win coins, climb leaderboards, and refer & earn with friends. India’s top play & win quiz app."
        canonical="https://quizdangal.com/"
        keywords={[
          'Quiz Dangal','quizdangal','quiz app','play quiz and win','opinion quiz','daily quiz India','refer and earn quiz','win rewards','leaderboards','online quiz contest'
        ]}
        alternateLocales={['hi_IN', 'en_US']}
      />
      <div className="relative z-10 h-full flex items-center justify-center px-4 mt-1 sm:mt-2 mb-6">
        <div className="w-full max-w-[420px]">
          {/* Intro header above categories */}
          <div
            className="text-center mb-4 animate-fade-up"
            style={{ '--fade-delay': '60ms' }}
          >
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent">
              Brain games, real gains. Ready to shine?
            </h1>
            <p className="text-[13px] text-slate-300/90 mt-1">
              Compete, earn, repeat — where winners never chill out.
            </p>
            <div className="mx-auto mt-2 h-[2px] w-24 rounded-full bg-gradient-to-r from-indigo-400/60 via-fuchsia-400/60 to-pink-400/60" />
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
        </div>
      </div>
  <StreakModal open={streakModal.open} day={streakModal.day} coins={streakModal.coins} onClose={() => setStreakModal(s => ({ ...s, open: false }))} />
      {/* Category modal removed in favor of page navigation */}
    </div>
  );
};

export default Home;
