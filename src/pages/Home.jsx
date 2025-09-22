// Clean rebuilt Home.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MessageSquare, Brain, Trophy, Clapperboard } from 'lucide-react';
import StreakModal from '@/components/StreakModal';

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
const Tile = ({ tile, quizzes, onJoin, index, joiningId }) => {
  const quiz = quizzes.find(q => (q.category || '').toLowerCase() === tile.slug.toLowerCase());
  const isLoading = joiningId && quiz && joiningId === quiz.id;
  const Icon = tile.icon;
  const variants = ['neon-orange', 'neon-purple', 'neon-teal', 'neon-pink'];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      onClick={() => quiz && !isLoading && onJoin(quiz)}
      disabled={!quiz || isLoading}
      className={`neon-card ${variants[index % variants.length]} group aspect-square w-full rounded-xl focus:outline-none will-change-transform transform-gpu ${(!quiz || isLoading) ? 'opacity-70 cursor-not-allowed' : ''}`}
      style={{ borderRadius: '0.75rem' }}
      aria-label={`${tile.title} - ${quiz ? (isLoading ? 'Joining…' : 'Play') : 'Coming soon'}`}
    >
      <div className="neon-card-content select-none flex items-center justify-center">
        <div className="w-full flex flex-col items-center justify-center gap-2">
          <Icon className="w-8 h-8 text-white drop-shadow" />
          <h3 className="text-base font-extrabold leading-tight text-white text-shadow-sm text-center">
            {tile.title}
          </h3>
          <span className="play-pill">{isLoading ? 'JOINING…' : (quiz ? 'PLAY' : 'SOON')}</span>
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

  const fetchQuizzesAndCounts = useCallback(async () => {
    try { const { data: quizzesData, error } = await supabase.from('quizzes').select('*').order('start_time', { ascending: true }); if (error) throw error; setQuizzes(quizzesData || []); }
    catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not fetch quizzes.', variant: 'destructive' }); setQuizzes([]); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchQuizzesAndCounts(); const i = setInterval(fetchQuizzesAndCounts, 30000); return () => clearInterval(i); }, [fetchQuizzesAndCounts]);

  useEffect(() => { if (!user || claimingRef.current) return; const claim = async () => { claimingRef.current = true; try { const { data, error } = await supabase.rpc('handle_daily_login', { user_uuid: user.id }); if (error) return console.error(error); if (data && data.is_new_login) { await refreshUserProfile(user); setStreakModal({ open: true, day: data.streak_day, coins: data.coins_earned }); } } finally { claimingRef.current = false; } }; const t = setTimeout(claim, 1200); return () => clearTimeout(t); }, [user, refreshUserProfile]);

  const handleJoinQuiz = async (quiz) => {
    if (!quiz || joiningId === quiz.id) return;
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to join the quiz.', variant: 'destructive' });
      navigate('/login');
      return;
    }
    setJoiningId(quiz.id);
    try {
      const { data, error } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id });
      if (error) throw error;
      if (data && data !== 'Joined Successfully') throw new Error(data);
      toast({ title: 'Joined!', description: 'Redirecting you to the quiz.' });
      navigate(`/quiz/${quiz.id}`);
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
      <div className="relative z-10 h-full flex items-center justify-center px-4 mt-1 sm:mt-2">
        <div className="w-full max-w-[420px]">
          <div className="grid grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square w-full rounded-xl bg-slate-800/60 border border-slate-700/60 animate-pulse" />
              ))
              : HOME_TILES.map((t, i) => (
                <Tile key={t.slug} tile={t} quizzes={quizzes} onJoin={handleJoinQuiz} index={i} joiningId={joiningId} />
              ))}
          </div>
        </div>
      </div>
      <StreakModal open={streakModal.open} day={streakModal.day} coins={streakModal.coins} onClose={() => setStreakModal(s => ({ ...s, open: false }))} />
    </div>
  );
};

export default Home;
