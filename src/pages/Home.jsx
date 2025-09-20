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
const Tile = ({ tile, quizzes, onJoin, index }) => {
  const quiz = quizzes.find(q => (q.category || '').toLowerCase() === tile.slug.toLowerCase());
  const Icon = tile.icon;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      onClick={() => quiz && onJoin(quiz)}
      className={`qd-tile tile-vivid-${vividFor(index)} group aspect-square w-full focus:outline-none will-change-transform transform-gpu`}
    >
      <div className="qd-tile-inner">
        <div className="flex items-start justify-between w-full">
          <div className="qd-tile-icon">
            <Icon className={`w-7 h-7 drop-shadow text-white/95`} />
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white shadow-sm border border-white/30`}>PLAY</span>
        </div>
        <div className="select-none">
          <h3 className={`font-extrabold text-base leading-tight text-shadow-sm text-white`}>{tile.title}</h3>
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

  const fetchQuizzesAndCounts = useCallback(async () => {
    try { const { data: quizzesData, error } = await supabase.from('quizzes').select('*').order('start_time', { ascending: true }); if (error) throw error; setQuizzes(quizzesData || []); }
    catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not fetch quizzes.', variant: 'destructive' }); setQuizzes([]); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchQuizzesAndCounts(); const i = setInterval(fetchQuizzesAndCounts, 30000); return () => clearInterval(i); }, [fetchQuizzesAndCounts]);

  useEffect(() => { if (!user || claimingRef.current) return; const claim = async () => { claimingRef.current = true; try { const { data, error } = await supabase.rpc('handle_daily_login', { user_uuid: user.id }); if (error) return console.error(error); if (data && data.is_new_login) { await refreshUserProfile(user); setStreakModal({ open: true, day: data.streak_day, coins: data.coins_earned }); } } finally { claimingRef.current = false; } }; const t = setTimeout(claim, 1200); return () => clearTimeout(t); }, [user, refreshUserProfile]);

  const handleJoinQuiz = async (quiz) => { try { const { data, error } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id }); if (error) throw error; if (data && data !== 'Joined Successfully') throw new Error(data); toast({ title: 'Joined!', description: 'Redirecting you to the quiz.' }); navigate(`/quiz/${quiz.id}`); } catch (err) { toast({ title: 'Error', description: err.message || 'Could not join quiz.', variant: 'destructive' }); } };

  return (
    <div className="h-full relative overflow-hidden">
      <div className="relative z-10 h-full flex items-center justify-center px-4 mt-1 sm:mt-2">
        <div className="w-full max-w-[420px]">
          <div className="qd-card rounded-3xl shadow-2xl p-3">
            <div className="grid grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square w-full rounded-2xl bg-slate-800/60 border border-slate-700/60 animate-pulse" />
              ))
              : HOME_TILES.map((t, i) => (
                <Tile key={t.slug} tile={t} quizzes={quizzes} onJoin={handleJoinQuiz} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <StreakModal open={streakModal.open} day={streakModal.day} coins={streakModal.coins} onClose={() => setStreakModal(s => ({ ...s, open: false }))} />
    </div>
  );
};

export default Home;
