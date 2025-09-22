import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trophy, Medal, Award, Users } from 'lucide-react';

const Results = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [didRefetchAfterCountdown, setDidRefetchAfterCountdown] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [quizId]);

  const fetchResults = async () => {
    try {
      // Load quiz meta (title, prizes)
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      setQuiz(quizData || null);

      // Load leaderboard from quiz_results (RLS-safe, shows only to participants)
      const { data: resRow, error: resErr } = await supabase
        .from('quiz_results')
        .select('leaderboard')
        .eq('quiz_id', quizId)
        .maybeSingle();
      if (resErr) throw resErr;

      const leaderboard = Array.isArray(resRow?.leaderboard) ? resRow.leaderboard : [];

      // If results aren't published yet
      if (!resRow || leaderboard.length === 0) {
        setResults([]);
        // Initialize countdown if result_time exists
        if (quizData?.result_time) {
          const target = new Date(quizData.result_time).getTime();
          const diff = target - Date.now();
          setTimeLeftMs(diff > 0 ? diff : 0);
        } else {
          setTimeLeftMs(null);
        }
        return;
      }

      // Normalize structure to what UI expects: rank, score, profiles
      // leaderboard items: { user_id, display_name, score, rank }
      const normalized = leaderboard
        .map((entry, idx) => ({
          id: `${quizId}-${entry.user_id}`,
          user_id: entry.user_id,
          score: Number(entry.score) || 0,
          rank: Number(entry.rank) || idx + 1,
          profiles: {
            username: entry.display_name?.startsWith('@') ? entry.display_name.slice(1) : undefined,
            full_name: entry.display_name,
            avatar_url: undefined,
          },
        }))
        .sort((a, b) => b.score - a.score);

      setResults(normalized);

      // Enrich top entries with avatar/username from profiles (non-blocking)
      try {
        const topIds = normalized.slice(0, 10).map(e => e.user_id);
        if (topIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', topIds);
          if (Array.isArray(profs)) {
            const map = new Map(profs.map(p => [p.id, p]));
            setResults(prev => prev.map(item => {
              const p = map.get(item.user_id);
              return p ? { ...item, profiles: { username: p.username, full_name: p.full_name, avatar_url: p.avatar_url } } : item;
            }));
          }
        }
      } catch {}

      // Find user's rank
      const me = normalized.find(p => p.user_id === user?.id);
      if (me) setUserRank(me);

    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  // Live countdown updater when results aren't available yet
  useEffect(() => {
    if (!quiz?.result_time || results.length > 0) {
      setTimeLeftMs(null);
      return;
    }

    const target = new Date(quiz.result_time).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff > 0) {
        setTimeLeftMs(diff);
      } else {
        setTimeLeftMs(0);
        // One-time refetch once countdown completes
        if (!didRefetchAfterCountdown) {
          setDidRefetchAfterCountdown(true);
          fetchResults();
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.result_time, results.length]);

  const formatTimeParts = (ms) => {
    const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return { days, hours, minutes, seconds };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-b"></div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="qd-card rounded-2xl p-6 shadow-lg text-center max-w-md w-full text-slate-100">
            <h2 className="text-2xl font-bold mb-2 text-white">Results not published yet</h2>
          {quiz?.result_time ? (
            <div className="mb-4">
              {timeLeftMs > 0 ? (
                <div>
                  <p className="text-slate-300 mb-3">Results will be published in</p>
                  {(() => {
                    const { days, hours, minutes, seconds } = formatTimeParts(timeLeftMs);
                    const part = (val, label) => (
                      <div className="px-3 py-2 rounded-md bg-slate-800/70 border border-slate-700 min-w-[64px]">
                        <div className="text-xl font-bold text-white tabular-nums">{val.toString().padStart(2,'0')}</div>
                        <div className="text-xs text-slate-400">{label}</div>
                      </div>
                    );
                    return (
                      <div className="flex items-center justify-center gap-2">
                        {days > 0 && part(days, 'Days')}
                        {part(hours, 'Hours')}
                        {part(minutes, 'Minutes')}
                        {part(seconds, 'Seconds')}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-slate-400 mt-3">Result time: {new Date(quiz.result_time).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-slate-300 mb-4">Publishing soon… please stay on this page.</p>
              )}
            </div>
          ) : (
            <p className="text-slate-300 mb-4">Please check back after the result time.</p>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="white" onClick={() => navigate('/my-quizzes')}>Back to My Quizzes</Button>
            <Button variant="brand" onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white text-shadow mb-2">
            Quiz Results
          </h1>
          <p className="text-slate-300">{quiz?.title}</p>
        </motion.div>

        <div className="flex justify-center gap-3 mb-8">
          <Button variant="white" onClick={() => navigate('/my-quizzes')}>Back to My Quizzes</Button>
          <Button variant="brand" onClick={async () => {
            try {
              const url = window.location.href;
              if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                toast({ title: 'Link copied', description: 'Result link copied to clipboard' });
              } else {
                window.prompt('Copy result link:', url);
              }
            } catch (e) {
              toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
            }
          }}>Share Result</Button>
        </div>

        {/* User's Result */}
        {userRank && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="qd-card rounded-2xl p-6 shadow-lg mb-8 text-slate-100"
          >
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                {userRank.rank === 1 ? (
                  <Trophy className="h-16 w-16 text-yellow-500" />
                ) : userRank.rank === 2 ? (
                  <Medal className="h-16 w-16 text-gray-400" />
                ) : userRank.rank === 3 ? (
                  <Award className="h-16 w-16 text-orange-500" />
                ) : (
                  <Users className="h-16 w-16 text-blue-500" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-white text-shadow-sm mb-2">
                Your Result
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-accent-b">#{userRank.rank}</p>
                  <p className="text-sm text-slate-300">Rank</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-400">{userRank.score}</p>
                  <p className="text-sm text-slate-300">Score</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-300">
                    ₹{userRank.rank <= 3 ? quiz?.prizes?.[userRank.rank - 1] || 0 : 0}
                  </p>
                  <p className="text-sm text-slate-300">Prize</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Prize Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="qd-card rounded-2xl p-6 shadow-lg mb-6 text-slate-100"
        >
          <h2 className="text-xl font-bold text-white mb-4">Prize Distribution</h2>
          {Array.isArray(quiz?.prizes) && quiz.prizes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {quiz.prizes.map((amount, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-800/70 flex items-center justify-between">
                  <div className="font-medium text-slate-100">{idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx+1}`}</div>
                  <div className="text-accent-b font-bold">₹{amount}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-300">No prize data available</div>
          )}
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="qd-card rounded-2xl p-6 shadow-lg text-slate-100"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Trophy className="mr-2 text-accent-a" />
            <span className="text-white">Leaderboard</span>
          </h2>
          
          <div className="space-y-4">
            {results.map((participant, index) => (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  participant.user_id === user.id 
                    ? 'bg-slate-800/70 border border-accent-b/50' 
                    : 'bg-slate-800/60 border border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-b text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                      {participant.profiles?.avatar_url ? (
                        <img src={participant.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(participant.profiles?.full_name || participant.profiles?.username || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {participant.profiles?.username || participant.profiles?.full_name || 'Anonymous'}
                      </p>
                      {participant.profiles?.full_name && participant.profiles?.username && (
                        <p className="text-xs text-slate-300">{participant.profiles.full_name}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-400">{participant.score}</p>
                    <p className="text-xs text-slate-300">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-300">
                      ₹{index < 3 ? (Array.isArray(quiz?.prizes) ? quiz.prizes[index] || 0 : 0) : 0}
                    </p>
                    <p className="text-xs text-slate-300">Prize</p>
                  </div>
                  {index < 3 && (
                    <div className="text-2xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;