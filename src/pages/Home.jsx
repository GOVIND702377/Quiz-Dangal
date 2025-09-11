// Clean rebuilt Home.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MessageSquare, Brain, Trophy, Clapperboard } from 'lucide-react';
import StreakModal from '@/components/StreakModal';

const HOME_TILES = [
  { title: 'Opinion', slug: 'opinion', icon: MessageSquare, gradient: 'from-[#f7971e] via-[#ffd200] to-[#f7971e]', accent: 'shadow-[0_6px_18px_-5px_rgba(247,151,30,0.55)]', description: 'Share what you think' },
  { title: 'G.K Knowledge', slug: 'gk', icon: Brain, gradient: 'from-[#667db6] via-[#0082c8] to-[#667db6]', accent: 'shadow-[0_6px_18px_-5px_rgba(0,130,200,0.55)]', description: 'Boost your facts' },
  { title: 'Sports', slug: 'sports', icon: Trophy, gradient: 'from-[#43cea2] via-[#185a9d] to-[#43cea2]', accent: 'shadow-[0_6px_18px_-5px_rgba(24,90,157,0.55)]', description: 'Play & win glory' },
  { title: 'Movies', slug: 'movies', icon: Clapperboard, gradient: 'from-[#fe9a8b] via-[#fd868c] to-[#f9748f]', accent: 'shadow-[0_6px_18px_-5px_rgba(249,116,143,0.55)]', description: 'Cinema & stars' },
];

// (Removed duplicate streak badge & user header area as per request)

const Tile = ({ tile, quizzes, onJoin, index }) => {
  const quiz = quizzes.find(q => (q.category || '').toLowerCase() === tile.slug.toLowerCase());
  return (
    <motion.button type="button" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, delay: index * 0.06 }} whileTap={{ scale: 0.95 }} onClick={() => quiz && onJoin(quiz)} className={`relative group aspect-square w-full rounded-3xl overflow-hidden focus:outline-none focus:ring-4 ring-white/30 text-left cursor-pointer shadow-lg ${tile.accent}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tile.gradient} opacity-90 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="absolute inset-0 mix-blend-overlay opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.4) 0, rgba(255,255,255,0) 60%)' }} />
      <div className="absolute -top-1/2 -left-1/2 w-[180%] h-[180%] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.55),rgba(255,255,255,0)_60%)] opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
      <div className="relative z-10 p-3 sm:p-4 flex flex-col h-full w-full justify-between">
        <div className="flex items-start justify-between w-full">
          <motion.div whileHover={{ rotate: 5 }} className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-white/15 backdrop-blur-sm border border-white/30 shadow-inner"><tile.icon className="w-6 h-6 text-white drop-shadow" /></motion.div>
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-2 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm text-[10px] font-semibold tracking-wide uppercase text-white shadow">Play</motion.div>
        </div>
        <div className="space-y-1 select-none">
          <h3 className="text-white font-extrabold text-sm sm:text-base leading-tight drop-shadow-md">{tile.title}</h3>
          <p className="text-[10px] sm:text-xs text-white/85 font-medium leading-snug line-clamp-2">{tile.description}</p>
        </div>
        <div className="absolute inset-0 rounded-3xl ring-0 ring-white/0 group-hover:ring-4 transition-all duration-300" />
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

  const fetchQuizzesAndCounts = useCallback(async () => {
    try { const { data: quizzesData, error } = await supabase.from('quizzes').select('*').order('start_time', { ascending: true }); if (error) throw error; setQuizzes(quizzesData || []); }
    catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not fetch quizzes.', variant: 'destructive' }); setQuizzes([]); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchQuizzesAndCounts(); const i = setInterval(fetchQuizzesAndCounts, 30000); return () => clearInterval(i); }, [fetchQuizzesAndCounts]);

  useEffect(() => { if (!user || claimingRef.current) return; const claim = async () => { claimingRef.current = true; try { const { data, error } = await supabase.rpc('handle_daily_login', { user_uuid: user.id }); if (error) return console.error(error); if (data && data.is_new_login) { await refreshUserProfile(user); setStreakModal({ open: true, day: data.streak_day, coins: data.coins_earned }); } } finally { claimingRef.current = false; } }; const t = setTimeout(claim, 1200); return () => clearTimeout(t); }, [user, refreshUserProfile]);

  const handleJoinQuiz = async (quiz) => { try { const { data, error } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id }); if (error) throw error; if (data && data !== 'Joined Successfully') throw new Error(data); toast({ title: 'Joined!', description: 'Redirecting you to the quiz.' }); navigate(`/quiz/${quiz.id}`); } catch (err) { toast({ title: 'Error', description: err.message || 'Could not join quiz.', variant: 'destructive' }); } };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="home-bg" />
      <div className="relative z-10 max-w-md mx-auto px-4 pb-8 pt-4 sm:pt-6">
  <div className="grid grid-cols-2 gap-3 mt-2">{loading ? Array.from({ length: 4 }).map((_, i) => (<div key={i} className="aspect-square w-full rounded-3xl bg-white/10 animate-pulse" />)) : HOME_TILES.map((t, i) => (<Tile key={t.slug} tile={t} quizzes={quizzes} onJoin={handleJoinQuiz} index={i} />))}</div>
      </div>
      <StreakModal open={streakModal.open} day={streakModal.day} coins={streakModal.coins} onClose={() => setStreakModal(s => ({ ...s, open: false }))} />
    </div>
  );
};

export default Home;
