import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Play, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils';
// Match Category status badge visuals
function statusBadge(s) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
  if (s === 'active') return base + ' bg-green-600/15 text-green-400 border border-green-700/40';
  if (s === 'upcoming') return base + ' bg-blue-600/15 text-blue-300 border border-blue-700/40';
  if (s === 'finished' || s === 'completed') return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
  return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
}


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
  const [tick, setTick] = useState(0); // live re-render for countdowns
  const [counts, setCounts] = useState({}); // quiz_id -> joined (pre + joined, where joined includes completed)

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

  const resultsChannel = supabase.channel('quiz-results-channel', { config: { broadcast: { ack: true } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_results' }, (payload) => {
        fetchMyQuizzes();
        // Notify user when results are out
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Quiz Result Ready', { body: 'Your quiz results are available. Tap to view.' });
          } catch {}
        }
      })
  .subscribe((status) => { /* no-op; acks reduce retries */ });
    
    // **FIX**: Loading state को सही ढंग से मैनेज करने के लिए एक async IIFE का उपयोग करें।
    const initialFetch = async () => {
      setLoading(true);
      await fetchMyQuizzes();
      setLoading(false);
    }
    initialFetch();

  const interval = setInterval(fetchMyQuizzes, 120000); // Poll every 2 minutes (realtime will push sooner)

    // live ticking every second when there are upcoming/active items
    const tickId = setInterval(() => setTick(t => (t + 1) % 1_000_000), 1000);

    return () => {
        supabase.removeChannel(resultsChannel);
        clearInterval(interval);
        clearInterval(tickId);
    };
  }, [user, fetchMyQuizzes]);

  // Fetch engagement counts for visible (non-finished) quizzes, same as Category
  useEffect(() => {
    const run = async () => {
      try {
        const now = Date.now();
        const ids = (quizzes || [])
          .filter(q => q.end_time && now < new Date(q.end_time).getTime())
          .map(q => q.id);
        if (!ids.length) { setCounts({}); return; }
        const { data, error } = await supabase.rpc('get_engagement_counts_many', { p_quiz_ids: ids });
        if (error) throw error;
        const map = {};
        for (const row of data || []) {
          const pre = row.pre_joined || 0;
          const joined = row.joined || 0; // SQL includes completed
          map[row.quiz_id] = pre + joined;
        }
        setCounts(map);
      } catch {
        setCounts({});
      }
    };
    if (quizzes && quizzes.length) run();
  }, [quizzes]);


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
            <h1 className="text-3xl font-bold heading-gradient text-shadow mb-8">My Quizzes</h1>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="qd-card rounded-2xl p-8 max-w-md mx-auto shadow-2xl"
            >
              <GoldTrophy size={104} />
              <h3 className="text-xl font-semibold text-white mb-2">No Quizzes Yet</h3>
              <p className="text-slate-300 mb-6">You haven't joined any quizzes. Play one to see your history!</p>
              <Button onClick={() => navigate('/')} variant="brand" className="w-full rounded-xl">
                <Play className="w-5 h-5 mr-2" /> Play Now
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Merge: Live/Upcoming (pre_joined or joined, but not finished), then Finished
  const nowTs = Date.now();
  const liveUpcoming = quizzes.filter(q => q.end_time && nowTs < new Date(q.end_time).getTime());
  const finished = quizzes.filter(q => q.end_time && nowTs >= new Date(q.end_time).getTime());
  // sort live/upcoming: active first, then by start time
  liveUpcoming.sort((a,b) => {
    const aSt = a.start_time ? new Date(a.start_time).getTime() : 0;
    const aEt = a.end_time ? new Date(a.end_time).getTime() : 0;
    const bSt = b.start_time ? new Date(b.start_time).getTime() : 0;
    const bEt = b.end_time ? new Date(b.end_time).getTime() : 0;
    const aActive = aSt && aEt && nowTs >= aSt && nowTs < aEt;
    const bActive = bSt && bEt && nowTs >= bSt && nowTs < bEt;
    if (aActive !== bActive) return aActive ? -1 : 1;
    // both not active: earlier start first
    return aSt - bSt;
  });

  return (
  <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold heading-gradient text-shadow mb-8 text-center">My Quizzes</h1>

          {liveUpcoming.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-3">Live/Upcoming</h2>
              <div className="space-y-3">
                {liveUpcoming.map((quiz, index) => {
                  const st = quiz.start_time ? new Date(quiz.start_time) : null;
                  const et = quiz.end_time ? new Date(quiz.end_time) : null;
                  const isActive = st && et && nowTs >= st.getTime() && nowTs < et.getTime();
                  const secs = isActive
                    ? Math.max(0, Math.floor((et.getTime() - Date.now())/1000))
                    : (st ? Math.max(0, Math.floor((st.getTime() - Date.now())/1000)) : 0);
                  const totalWindow = (st && et) ? Math.max(1, et.getTime() - st.getTime()) : null;
                  const progressed = isActive && totalWindow ? Math.min(100, Math.max(0, Math.round(((Date.now() - st.getTime()) / totalWindow) * 100))) : null;
                  const prizes = Array.isArray(quiz.prizes) ? quiz.prizes : [];
                  const p1 = prizes[0] || 0, p2 = prizes[1] || 0, p3 = prizes[2] || 0;
                  const joined = counts[quiz.id] || 0;
                  return (
                    <motion.div
                      key={`lu-${quiz.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                      className={`relative overflow-hidden rounded-2xl border ${isActive ? 'border-emerald-700/50' : 'border-slate-800'} bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-slate-900/60 shadow-xl cursor-pointer group hover:-translate-y-0.5 transition-transform qd-card p-4`}
                    >
                      {/* Background accents to match Category */}
                      <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(1200px 300px at -10% -10%, rgba(99,102,241,0.06), transparent), radial-gradient(900px 200px at 110% 20%, rgba(16,185,129,0.05), transparent)'}} />

                      {/* Status ribbon */}
                      {isActive && (
                        <div className="absolute -left-10 top-3 rotate-[-15deg]">
                          <span className="bg-rose-600 text-white text-[10px] font-extrabold tracking-widest px-6 py-1 rounded shadow-lg ring-1 ring-rose-300/50">LIVE</span>
                        </div>
                      )}
                      {!isActive && st && (
                        <div className="absolute -left-10 top-3 rotate-[-15deg]">
                          <span className="bg-sky-600 text-white text-[10px] font-extrabold tracking-widest px-6 py-1 rounded shadow-lg ring-1 ring-sky-300/50">SOON</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="truncate font-semibold text-slate-100 text-base sm:text-lg">{quiz.title}</div>
                            <span className={statusBadge(isActive ? 'active' : 'upcoming')}>{isActive ? 'active' : 'upcoming'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isActive ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40' : 'bg-indigo-500/15 text-indigo-300 border-indigo-700/40'}`}>Joined</span>
                          </div>

                          {/* Prize Chips (mirror Category) */}
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-200 border border-amber-500/30 shadow-sm">🥇 ₹{p1}</span>
                            <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-sky-400/10 text-sky-200 border border-sky-500/30 shadow-sm">🥈 ₹{p2}</span>
                            <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-violet-400/10 text-violet-200 border border-violet-500/30 shadow-sm">🥉 ₹{p3}</span>
                          </div>

                          {/* Date + time chips */}
                          <div className="mt-2">
                            <div className="text-[11px] text-slate-400">{quiz.start_time ? formatDateOnly(quiz.start_time) : '—'}</div>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                              <div className="bg-slate-800/50 border border-slate-700 rounded-md px-2 py-1">
                                <span className="uppercase text-[9px] text-slate-400">Start</span>
                                <div>{quiz.start_time ? formatTimeOnly(quiz.start_time) : '—'}</div>
                              </div>
                              <div className="bg-slate-800/50 border border-slate-700 rounded-md px-2 py-1">
                                <span className="uppercase text-[9px] text-slate-400">End</span>
                                <div>{quiz.end_time ? formatTimeOnly(quiz.end_time) : '—'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Countdown */}
                          {secs !== null && (
                            <div className="mt-2 text-sm font-semibold text-indigo-300">
                              {isActive ? 'Ends in' : 'Starts in'} {String(Math.floor(secs/60)).padStart(2,'0')}:{String(secs%60).padStart(2,'0')}
                            </div>
                          )}

                          {/* Engagement summary: show combined joined number like Category */}
                          <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                            <span className="inline-flex items-center"><Users className="w-3.5 h-3.5 mr-1" />{joined} joined</span>
                          </div>

                          {/* Progress bar when active */}
                          {progressed !== null && (
                            <div className="mt-2 w-full bg-slate-800/50 border border-slate-700/70 rounded-full h-1 overflow-hidden">
                              <div className="h-1 bg-emerald-500/80" style={{ width: `${progressed}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <h2 className="text-xl font-semibold text-white mb-3">Finished</h2>
          <div className="space-y-4">
          {finished.map((quiz, index) => {
            const now = new Date();
            const endTime = new Date(quiz.end_time);
            const isResultOut = now >= endTime && quiz.leaderboard;
            const userRank = isResultOut ? quiz.leaderboard.find(p => p.user_id === user.id) : null;
            
            return(
              <motion.div key={quiz.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }}
                onClick={() => navigate(`/quiz/${quiz.id}`)}
                className="qd-card rounded-2xl p-6 shadow-xl text-slate-100 cursor-pointer group">
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
                        <p className="text-slate-300">{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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