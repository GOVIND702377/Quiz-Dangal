import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Play, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const LeaderboardDisplay = ({ leaderboard, currentUser }) => {
  const top10 = leaderboard.slice(0, 10);
  const userRank = leaderboard.find(p => p.user_id === currentUser.id);

  const rankColor = (rank) => {
    if (rank === 1) return 'text-amber-300';
    if (rank === 2) return 'text-slate-200';
    if (rank === 3) return 'text-orange-300';
    return 'text-slate-300';
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-lg text-center text-slate-100">Leaderboard</h4>
      <div className="space-y-2">
        {top10.map((player) => (
          <div
            key={player.user_id}
            className={`flex items-center justify-between p-3 rounded-xl border transition ${
              player.user_id === currentUser.id
                ? 'bg-indigo-900/30 border-indigo-600/50 shadow-lg'
                : 'bg-slate-900/60 border-slate-700/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`font-extrabold tabular-nums w-8 text-center ${rankColor(player.rank)}`}>{player.rank}.</span>
              <span className="font-medium text-slate-100 truncate">{player.display_name}</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-indigo-300">{player.score} <span className="text-sm font-normal text-slate-300">pts</span></p>
            </div>
          </div>
        ))}
      </div>
      {userRank && userRank.rank > 10 && (
        <>
          <div className="text-center text-slate-500">...</div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/30 border border-indigo-600/50 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-extrabold tabular-nums w-8 text-center text-indigo-200">{userRank.rank}.</span>
              <span className="font-medium text-slate-100 truncate">{userRank.display_name}</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-indigo-300">{userRank.score} <span className="text-sm font-normal text-slate-300">pts</span></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const GoldTrophy = ({ size = 72 }) => {
  const px = typeof size === 'number' ? `${size}px` : size;
  const [srcIdx, setSrcIdx] = useState(0);
  const sources = [
    `${import.meta.env.BASE_URL}Trophy.png`, // provided image (preferred)
    `${import.meta.env.BASE_URL}trophy.png`, // lowercase fallback just in case
    `${import.meta.env.BASE_URL}trophy-question.png`,
    `${import.meta.env.BASE_URL}trophy-question.webp`,
  ];
  const src = sources[srcIdx] || sources[0];

  // Directly use provided transparent image; no processing to ensure perfect blending
  return (
    <div className="relative trophy-float mx-auto mb-4 pointer-events-none" style={{ width: px, height: px }}>
      <div className="trophy-sway w-full h-full">
        <div className="trophy-pulse w-full h-full">
      {srcIdx >= 0 ? (
        <img
          src={src}
          alt="Trophy"
      className="w-full h-full object-contain select-none"
      style={{ backgroundColor: 'transparent', display: 'block' }}
          loading="eager"
          decoding="async"
          onError={() => { const next = srcIdx + 1; if (next < sources.length) setSrcIdx(next); else setSrcIdx(-1); }}
        />
      ) : (
        <svg viewBox="0 0 128 128" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <linearGradient id="qdTg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe795" />
              <stop offset="45%" stopColor="#ffd34d" />
              <stop offset="75%" stopColor="#f0a700" />
              <stop offset="100%" stopColor="#b86a00" />
            </linearGradient>
            <linearGradient id="qdQM" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6d28d9" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <path d="M28 30c-10 0-18 10-16 20 2 10 14 14 24 11" fill="none" stroke="#f0b000" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M100 30c10 0 18 10 16 20-2 10-14 14-24 11" fill="none" stroke="#f0b000" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 22h72c0 24-10 36-26 41v9c0 7-6 13-14 13s-14-6-14-13v-9C38 58 28 46 28 22Z" fill="url(#qdTg)" />
          <rect x="56" y="72" width="16" height="10" rx="3" fill="url(#qdTg)" />
          <rect x="44" y="82" width="40" height="12" rx="4" fill="url(#qdTg)" />
          <rect x="36" y="94" width="56" height="10" rx="5" fill="url(#qdTg)" />
          <text x="64" y="46" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="900" fill="url(#qdQM)" stroke="#2b1a59" strokeWidth="3" paintOrder="stroke fill">?</text>
        </svg>
          )}
        </div>
      </div>
      {/* overlays removed to avoid altering section background */}
    </div>
  );
};


const MyQuizzes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyQuizzes = useCallback(async () => {
    if (!user) return;
    try {
      // **FIX**: अब हम सीधे 'my_quizzes_view' से डेटा लाएंगे।
      // RLS अपने आप सही डेटा फ़िल्टर कर देगा।
      const { data, error } = await supabase
        .from('my_quizzes_view')
        .select('*');

      if (error) {
        console.error('Error fetching my quizzes view:', error);
        setQuizzes([]);
        return;
      }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // **FIX**: अब डेटा को कंबाइन करने की जरूरत नहीं है, क्योंकि व्यू से सब कुछ एक साथ आता है।
    const combinedData = (data || []).map(s => {
        // Hide result if it's older than 1 hour
        if (s.leaderboard && new Date(s.result_shown_at) < oneHourAgo) {
            return { ...s, leaderboard: null, resultExpired: true };
        }
        return { ...s };
    });

    setQuizzes(combinedData);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    // Ask for notification permission once
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const resultsChannel = supabase.channel('quiz-results-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_results' }, (payload) => {
        fetchMyQuizzes();
        // Notify user when results are out
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Quiz Result Ready', { body: 'Your quiz results are available. Tap to view.' });
          } catch {}
        }
      })
      .subscribe();
    
    // **FIX**: Loading state को सही ढंग से मैनेज करने के लिए एक async IIFE का उपयोग करें।
    const initialFetch = async () => {
      setLoading(true);
      await fetchMyQuizzes();
      setLoading(false);
    }
    initialFetch();

    const interval = setInterval(fetchMyQuizzes, 60000); // Poll every minute

    return () => {
        supabase.removeChannel(resultsChannel);
        clearInterval(interval);
    };
  }, [user, fetchMyQuizzes]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
  <div className="min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center text-slate-100">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-8">My Quizzes</h1>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-8 max-w-md mx-auto shadow-xl">
              <GoldTrophy size={104} />
              <h3 className="text-xl font-semibold text-white mb-2">No Quizzes Yet</h3>
              <p className="text-slate-300 mb-6">You haven't joined any quizzes. Play one to see your history!</p>
              <Button onClick={() => navigate('/')}
                className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-700 text-white font-semibold py-3 rounded-lg shadow-lg">
                <Play className="w-5 h-5 mr-2" /> Play Now
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-center mb-4"><GoldTrophy size={112} /></div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-8 text-center">My Quizzes & Leaderboard</h1>
          <div className="space-y-4">
          {quizzes.map((quiz, index) => {
            const now = new Date();
            const resultTime = new Date(quiz.result_time);
            const isResultOut = now >= resultTime && quiz.leaderboard;
            const userRank = isResultOut ? quiz.leaderboard.find(p => p.user_id === user.id) : null;
            
            return(
              <motion.div key={quiz.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-6 shadow-xl text-slate-100">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xl font-semibold text-white truncate pr-3">{quiz.title}</h3>
                   <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${isResultOut ? 'bg-emerald-900/25 text-emerald-200 border-emerald-500/30' : (quiz.resultExpired ? 'bg-slate-800/60 text-slate-300 border-slate-700/60' : 'bg-amber-900/25 text-amber-200 border-amber-500/30')}`}>
                      {isResultOut ? 'Completed' : (quiz.resultExpired ? 'Expired' : 'Awaiting Results')}
                   </div>
                </div>

                {isResultOut ? (
                    <>
                        {userRank && (
                            <div className="bg-slate-900/60 rounded-xl p-4 flex justify-around items-center text-center mb-4 border border-slate-700/60">
                                <div>
                                    <p className="text-xs text-slate-400">Your Rank</p>
                                    <p className="text-2xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">#{userRank.rank}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Your Score</p>
                                    <p className="text-2xl font-bold text-indigo-300">{userRank.score}</p>
                                </div>
                            </div>
                        )}
                        <LeaderboardDisplay leaderboard={quiz.leaderboard} currentUser={user} />
                    </>
                ) : quiz.resultExpired ? (
                    <div className="text-center p-4 bg-slate-900/60 rounded-xl border border-slate-700/60">
                        <Clock className="mx-auto h-8 w-8 text-slate-400 mb-2"/>
                        <p className="font-semibold text-slate-200">Results for this quiz have expired.</p>
                    </div>
                ) : (
                    <div className="text-center p-4 bg-slate-900/60 rounded-xl border border-slate-700/60">
                        <Clock className="mx-auto h-8 w-8 text-slate-400 mb-2"/>
                        <p className="font-semibold text-slate-200">Results will be declared at</p>
                        <p className="text-slate-300">{resultTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                )}
              </motion.div>
            )
          })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyQuizzes;