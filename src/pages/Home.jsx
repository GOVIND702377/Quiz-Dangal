// Clean rebuilt Home.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import SEO from '@/components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
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

const accentFor = (i) => ['a','b','c','d'][i % 4];
const vividFor = (i) => ['1','2','3','4'][i % 4];
const Tile = ({ tile, quizzes, onJoin, index, joiningId, onOpenList, navigateTo }) => {
  // pick active or upcoming by TIME (ignore possibly stale status)
  const now = Date.now();
  const relevant = quizzes
    .filter(q => (q.category || '').toLowerCase() === tile.slug.toLowerCase())
    .filter(q => {
      const st = q.start_time ? new Date(q.start_time).getTime() : 0;
      const et = q.end_time ? new Date(q.end_time).getTime() : 0;
      const isActive = st && et && now >= st && now < et;
      const isUpcoming = st && now < st;
      return isActive || isUpcoming;
    })
    .sort((a,b) => new Date(a.start_time || a.end_time || 0) - new Date(b.start_time || b.end_time || 0));
  const quiz = relevant[0];
  // Accurate total count for this category: only active or upcoming quizzes
  const totalCount = relevant.length;
  const isLoading = joiningId && quiz && joiningId === quiz.id;
  const Icon = tile.icon;
  const variants = ['neon-orange', 'neon-purple', 'neon-teal', 'neon-pink'];
  // Palette for badge per tile
  const palettes = [
    { from: 'from-rose-500', to: 'to-amber-400' },
    { from: 'from-violet-500', to: 'to-indigo-400' },
    { from: 'from-emerald-500', to: 'to-teal-400' },
    { from: 'from-sky-500', to: 'to-cyan-400' },
  ];
  const pal = palettes[index % palettes.length];
  // Always show PLAY instead of SOON/other states (as requested)
  const label = 'PLAY';
  return (
      <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      // Click sound handled globally via SoundProvider pointerdown listener
      onClick={() => navigateTo(tile.slug)}
      className={`neon-card ${variants[index % variants.length]} group aspect-square w-full rounded-xl focus:outline-none will-change-transform transform-gpu transition-transform hover:scale-[1.02] hover:shadow-xl relative`}
      style={{ borderRadius: '0.75rem' }}
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
      </motion.button>
  );
};

const Home = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streakModal, setStreakModal] = useState({ open: false, day: 0, coins: 0 });
  const claimingRef = useRef(false);
  const [joiningId, setJoiningId] = useState(null);
  // Removed list modal state

  const fetchQuizzesAndCounts = useCallback(async () => {
    try {
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('id,title,category,start_time,end_time,status,prize_pool,prizes')
        .order('start_time', { ascending: true });
      if (error) throw error;
      setQuizzes(quizzesData || []);
    }
    catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not fetch quizzes.', variant: 'destructive' }); setQuizzes([]); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchQuizzesAndCounts(); const i = setInterval(fetchQuizzesAndCounts, 60000); return () => clearInterval(i); }, [fetchQuizzesAndCounts]);

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
      />
      <div className="relative z-10 h-full flex items-center justify-center px-4 mt-1 sm:mt-2 mb-6">
        <div className="w-full max-w-[420px]">
          {/* Intro header above categories */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center mb-4"
          >
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent">
              Brain games, real gains. Ready to shine?
            </h1>
            <p className="text-[13px] text-slate-300/90 mt-1">
              Compete, earn, repeat — where winners never chill out.
            </p>
            <div className="mx-auto mt-2 h-[2px] w-24 rounded-full bg-gradient-to-r from-indigo-400/60 via-fuchsia-400/60 to-pink-400/60" />
          </motion.div>
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
                  navigateTo={(slug) => navigate(`/category/${slug}`)}
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
