import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Play, Loader2, Award } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const LeaderboardDisplay = ({ leaderboard, currentUser }) => {
    const top10 = leaderboard.slice(0, 10);
    const userRank = leaderboard.find(p => p.user_id === currentUser.id);

    return (
        <div className="space-y-3">
            <h4 className="font-semibold text-lg text-center text-gray-800">Leaderboard</h4>
            <div className="space-y-2">
                {top10.map((player, index) => (
                    <div key={player.user_id} className={`flex items-center justify-between p-3 rounded-lg ${player.user_id === currentUser.id ? 'bg-indigo-100 border-2 border-indigo-400' : 'bg-gray-50/80'}`}>
                        <div className="flex items-center">
                            <span className="font-bold text-gray-700 w-8">{player.rank}.</span>
                            <span className="font-medium text-gray-800 truncate">{player.display_name}</span>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-indigo-600">{player.score} <span className="text-sm font-normal">pts</span></p>
                        </div>
                    </div>
                ))}
            </div>
            {userRank && userRank.rank > 10 && (
                <>
                    <div className="text-center text-gray-500">...</div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-100 border-2 border-indigo-400">
                         <div className="flex items-center">
                            <span className="font-bold text-gray-700 w-8">{userRank.rank}.</span>
                            <span className="font-medium text-gray-800 truncate">{userRank.display_name}</span>
                        </div>
                         <div className="text-right">
                           <p className="font-bold text-indigo-600">{userRank.score} <span className="text-sm font-normal">pts</span></p>
                        </div>
                    </div>
                </>
            )}
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
        <Loader2 className="h-16 w-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl font-bold gradient-text mb-8">My Quizzes</h1>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-8 max-w-md mx-auto shadow-lg">
            <Trophy className="mx-auto h-12 w-12 text-indigo-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-4">No Quizzes Yet</h3>
            <p className="text-gray-600 mb-6">You haven't joined any quizzes. Play one to see your history!</p>
            <Button onClick={() => navigate('/')}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg">
              <Play className="w-5 h-5 mr-2" /> Play Now
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold gradient-text mb-8 text-center">My Quizzes & Leaderboard</h1>
        <div className="space-y-4">
          {quizzes.map((quiz, index) => {
            const now = new Date();
            const resultTime = new Date(quiz.result_time);
            const isResultOut = now >= resultTime && quiz.leaderboard;
            const userRank = isResultOut ? quiz.leaderboard.find(p => p.user_id === user.id) : null;
            
            return(
              <motion.div key={quiz.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xl font-semibold text-gray-800">{quiz.title}</h3>
                   <div className={`px-3 py-1 rounded-full text-sm font-medium ${isResultOut ? 'bg-green-100 text-green-700' : (quiz.resultExpired ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700')}`}>
                      {isResultOut ? 'Completed' : (quiz.resultExpired ? 'Expired' : 'Awaiting Results')}
                   </div>
                </div>

                {isResultOut ? (
                    <>
                        {userRank && (
                            <div className="bg-gray-50/80 rounded-lg p-4 flex justify-around items-center text-center mb-4">
                                <div>
                                    <p className="text-sm text-gray-500">Your Rank</p>
                                    <p className="text-2xl font-bold gradient-text">#{userRank.rank}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Your Score</p>
                                    <p className="text-2xl font-bold text-indigo-600">{userRank.score}</p>
                                </div>
                            </div>
                        )}
                        <LeaderboardDisplay leaderboard={quiz.leaderboard} currentUser={user} />
                    </>
                ) : quiz.resultExpired ? (
                    <div className="text-center p-4 bg-gray-50/80 rounded-lg">
                        <Clock className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
                        <p className="font-semibold text-gray-700">Results for this quiz have expired.</p>
                    </div>
                ) : (
                    <div className="text-center p-4 bg-gray-50/80 rounded-lg">
                        <Clock className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
                        <p className="font-semibold text-gray-700">Results will be declared at</p>
                        <p className="text-gray-600">{resultTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default MyQuizzes;