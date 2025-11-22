import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from '@/lib/motion-lite';
import { supabase } from '@/lib/customSupabaseClient';
import { smartJoinQuiz } from '@/lib/smartJoinQuiz';
import { rateLimit } from '@/lib/security';
import { formatDateOnly, formatTimeOnly, getPrizeDisplay, prefetchRoute } from '@/lib/utils';
import { RECENT_COMPLETED_GRACE_MIN } from '@/constants';
import { useToast } from '@/components/ui/use-toast';
import { Users, MessageSquare, Brain, Clapperboard, Clock, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import SEO from '@/components/SEO';

function statusBadge(s) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
  if (s === 'active') return base + ' bg-green-600/15 text-green-400 border border-green-700/40';
  if (s === 'upcoming') return base + ' bg-blue-600/15 text-blue-300 border border-blue-700/40';
  if (s === 'finished' || s === 'completed') return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
  return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
}

function categoryMeta(slug = '') {
  const s = String(slug || '').toLowerCase();
  if (s.includes('opinion')) return { title: 'Opinion Quizzes', emoji: '💬', Icon: MessageSquare, from: 'from-indigo-600/30', to: 'to-fuchsia-600/30', ring: 'ring-fuchsia-500/30' };
  if (s.includes('gk')) return { title: 'GK Quizzes', emoji: '🧠', Icon: Brain, from: 'from-emerald-600/30', to: 'to-teal-600/30', ring: 'ring-emerald-500/30' };
  if (s.includes('sport')) return { title: 'Sports Quizzes', emoji: '🏆', Icon: Trophy, from: 'from-orange-600/30', to: 'to-red-600/30', ring: 'ring-orange-500/30' };
  if (s.includes('movie')) return { title: 'Movie Quizzes', emoji: '🎬', Icon: Clapperboard, from: 'from-violet-600/30', to: 'to-indigo-600/30', ring: 'ring-violet-500/30' };
  return { title: `${slug} Quizzes`, emoji: '⭐', Icon: MessageSquare, from: 'from-sky-600/30', to: 'to-indigo-600/30', ring: 'ring-sky-500/30' };
}

const CategoryQuizzes = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSubscribed, subscribeToPush } = usePushNotifications();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [counts, setCounts] = useState({}); // { [quizId]: joined (pre+joined+completed as joined) }
  const [joinedMap, setJoinedMap] = useState({}); // quiz_id -> 'joined' | 'pre'
  const [tick, setTick] = useState(0); // reintroduced for live countdown display recalculation

  const fetchQuizzes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
  .select('id,title,category,start_time,end_time,status,prize_pool,prizes,prize_type')
        .eq('category', slug)
        .order('start_time', { ascending: true });
      if (error) throw error;
      setQuizzes(data || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not load quizzes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => { setLoading(true); fetchQuizzes(); }, [fetchQuizzes]);

  // Live countdown tick (only when there are active/upcoming quizzes)
  useEffect(() => {
    const now = Date.now();
    const hasLive = (quizzes || []).some(q => {
      const st = q.start_time ? new Date(q.start_time).getTime() : 0;
      const et = q.end_time ? new Date(q.end_time).getTime() : 0;
      return (st && now < st) || (st && et && now >= st && now < et);
    });
    if (!hasLive) return;
    const id = setInterval(() => setTick(t => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [quizzes]);

  // Fetch participant counts using bulk RPC; joined = pre_joined + joined(completed included)
  useEffect(() => {
    const run = async () => {
      try {
        const ids = (quizzes || []).map(q => q.id);
        if (!ids.length) { setCounts({}); return; }
        const { data, error } = await supabase.rpc('get_engagement_counts_many', { p_quiz_ids: ids });
        if (error) throw error;
        const map = {};
        for (const row of data || []) {
          const pre = row.pre_joined || 0;
          const joined = row.joined || 0; // already includes completed per SQL
          map[row.quiz_id] = pre + joined;
        }
        setCounts(map);
  } catch (e) { /* fetch categories fail */ }
    };
    if (quizzes && quizzes.length) run();
  }, [quizzes]);

  // Fetch whether current user has joined or pre-joined each quiz
  useEffect(() => {
    const run = async () => {
      if (!user || !quizzes?.length) { setJoinedMap({}); return; }
      try {
        const ids = quizzes.map(q => q.id);
        const { data, error } = await supabase
          .from('quiz_participants')
          .select('quiz_id,status')
          .eq('user_id', user.id)
          .in('quiz_id', ids);
        if (error) throw error;
        const map = {};
        for (const r of data || []) {
          map[r.quiz_id] = r.status === 'pre_joined' ? 'pre' : 'joined';
        }
        setJoinedMap(map);
      } catch {
        setJoinedMap({});
      }
    };
    run();
  }, [user, quizzes]);

  const handleJoin = async (q) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to join the quiz.', variant: 'destructive' });
      navigate('/login');
      return;
    }
    // Immediately reflect UI state
    setJoiningId(q.id);
    // Try to enable push notifications on first join/pre-join (fire-and-forget; don't block join)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && !isSubscribed) {
        // Do not await to avoid stalling join on desktop
        Promise.resolve().then(() => subscribeToPush()).catch(() => {});
      }
    } catch { /* ignore push errors */ }
    try {
      const result = await smartJoinQuiz({ supabase, quiz: q, user });
      if (result.status === 'error') throw result.error;
      if (result.status === 'already') {
        setJoinedMap(prev => ({ ...prev, [q.id]: 'joined' }));
        toast({ title: 'Already Joined', description: 'You are in this quiz.' });
      } else if (result.status === 'joined') {
        setJoinedMap(prev => ({ ...prev, [q.id]: 'joined' }));
        const rl = rateLimit(`join_${user?.id || 'anon'}`, { max: 4, windowMs: 8000 });
        if (!rl.allowed) {
          toast({ title: 'Slow down', description: 'Please wait a moment before trying again.', variant: 'destructive' });
        } else {
          toast({ title: 'Joined!', description: 'Taking you to the quiz.' });
          navigate(`/quiz/${q.id}`);
        }
      } else if (result.status === 'pre_joined') {
        setJoinedMap(prev => ({ ...prev, [q.id]: 'pre' }));
        toast({ title: 'Pre-joined!', description: 'We will remind you before start.' });
      } else if (result.status === 'scheduled_retry') {
        setJoinedMap(prev => ({ ...prev, [q.id]: 'pre' }));
        toast({ title: 'Pre-joined!', description: 'Auto joining at start time.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Could not join quiz.', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  // Show ONLY Active + Upcoming quizzes (exclude recently finished)
  const filtered = quizzes.filter(q => {
    const now = Date.now();
    const st = q.start_time ? new Date(q.start_time).getTime() : 0;
    const et = q.end_time ? new Date(q.end_time).getTime() : 0;
    const isActive = st && et && now >= st && now < et;
    const isUpcoming = st && now < st;
    return isActive || isUpcoming;
  });

  const meta = categoryMeta(slug);
  
  // Header stats: active/upcoming counts and next start
  const nowHeader = Date.now();
  const activeCount = (quizzes || []).reduce((acc, q) => {
    const st = q.start_time ? new Date(q.start_time).getTime() : 0;
    const et = q.end_time ? new Date(q.end_time).getTime() : 0;
    return acc + (st && et && nowHeader >= st && nowHeader < et ? 1 : 0);
  }, 0);
  const upcomingCount = (quizzes || []).reduce((acc, q) => {
    const st = q.start_time ? new Date(q.start_time).getTime() : 0;
    return acc + (st && nowHeader < st ? 1 : 0);
  }, 0);
  const nextStartTs = (quizzes || [])
    .map(q => q.start_time ? new Date(q.start_time).getTime() : null)
    .filter(ts => ts && ts > nowHeader)
    .sort((a,b) => a - b)[0] || null;

  // Removed recent finished inclusion from display; do not mention in description

  const canonical = typeof window !== 'undefined'
    ? `${window.location.origin}/category/${slug}/`
    : `https://quizdangal.com/category/${slug}/`;
  // Ensures legacy SEO template referencing hasRecent does not break lint; we deliberately exclude recent finished quizzes now.
  const hasRecent = false;

  return (
    <div className="container mx-auto px-4 py-3 text-foreground">
      <SEO
        title={`${meta.title} – Quiz Dangal`}
        description={`Active and upcoming quizzes${hasRecent ? ' + recent results' : ''} in ${meta.title}.`}
        canonical={canonical}
        robots="index, follow"
      />
      <span className="hidden" aria-hidden>{tick}</span>
      {/* Hero Header */}
      <div className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r ${meta.from} ${meta.to} shadow-xl mb-4`}>
        <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(700px 180px at -10% -20%, rgba(255,255,255,0.07), transparent), radial-gradient(420px 100px at 110% 10%, rgba(255,255,255,0.05), transparent)'}} />
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left: Title and meta */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 grid place-items-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl ring-2 ring-white/20 bg-white/10 text-white text-xl sm:text-2xl shadow" aria-hidden>
                {meta.emoji}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{meta.title}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/85">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-200 border border-emerald-500/30">{activeCount} live</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-600/20 text-sky-200 border border-sky-500/30">{upcomingCount} upcoming</span>
                  {nextStartTs && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/20">
                      <Clock className="w-3.5 h-3.5" /> Next: {formatDateOnly(nextStartTs)} • {formatTimeOnly(nextStartTs)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: removed filter pills per request */}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/60 border border-slate-700/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">No quizzes in this category yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((q, idx) => {
            // use tick to trigger re-render every second
            const now = Date.now();
            const st = q.start_time ? new Date(q.start_time).getTime() : null;
            const et = q.end_time ? new Date(q.end_time).getTime() : null;
            const isActive = st && et && now >= st && now < et;
            const isUpcoming = st && now < st;
            const isRecentCompleted = et && now >= et && (now - et) <= (RECENT_COMPLETED_GRACE_MIN * 60 * 1000);
            const canJoin = isActive || isUpcoming;
            const secs = isUpcoming && st ? Math.max(0, Math.floor((st - now)/1000)) : (isActive && et ? Math.max(0, Math.floor((et - now)/1000)) : null);
                  const prizes = Array.isArray(q.prizes) ? q.prizes : [];
                  const prizeType = q.prize_type || 'coins';
                  const p1 = prizes[0] ?? 0;
                  const p2 = prizes[1] ?? 0;
                  const p3 = prizes[2] ?? 0;
                  const formatPrize = (value) => {
                    const display = getPrizeDisplay(prizeType, value, { fallback: 0 });
                    // Plain text only, no coin icon
                    return display.formatted;
                  };
            const joined = counts[q.id] || 0;
            const myStatus = joinedMap[q.id];
            // unified UX: show only JOIN/JOINED; treat pre-joined as Joined in UI
            const already = !!myStatus; // 'pre' or 'joined' both count as joined for display
            const totalWindow = (st && et) ? Math.max(1, et - st) : null;
            const progressed = isActive && totalWindow ? Math.min(100, Math.max(0, Math.round(((now - st) / totalWindow) * 100))) : null;
            return (
              <m.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => navigate(`/quiz/${q.id}`)}
                className={`relative overflow-hidden rounded-2xl border ${isActive ? 'border-emerald-700/50' : 'border-slate-800'} bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-slate-900/60 shadow-xl cursor-pointer group hover:-translate-y-0.5 transition-transform`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/quiz/${q.id}`); }}
              >
                {/* Background accents */}
                <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(1200px 300px at -10% -10%, rgba(99,102,241,0.06), transparent), radial-gradient(900px 200px at 110% 20%, rgba(16,185,129,0.05), transparent)'}} />

                {/* Status chip (top-right, avoids title overlap) */}
                <div className="absolute top-3 right-3 z-10 flex gap-2">
                  {isActive && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-widest bg-rose-600 text-white ring-1 ring-rose-300/50 shadow">LIVE</span>
                  )}
                  {isUpcoming && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-widest bg-sky-600 text-white ring-1 ring-sky-300/50 shadow">SOON</span>
                  )}
                  {!isActive && !isUpcoming && isRecentCompleted && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-widest bg-slate-700 text-white ring-1 ring-slate-400/40 shadow">RECENT</span>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-full font-semibold text-slate-100 text-base sm:text-lg whitespace-normal break-words leading-snug pr-12 sm:pr-16">{q.title}</div>
                        <span className={statusBadge(isActive ? 'active' : (isUpcoming ? 'upcoming' : 'finished'))}>{isActive ? 'active' : (isUpcoming ? 'upcoming' : 'finished')}{(!isActive && !isUpcoming && isRecentCompleted) ? ' (recent)' : ''}</span>
                        {myStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isActive ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40' : 'bg-indigo-500/15 text-indigo-300 border-indigo-700/40'}`}>
                            Joined
                          </span>
                        )}
                      </div>

                      {/* Prize Chips (more attractive) */}
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-200 border border-amber-500/30 shadow-sm">🥇 {formatPrize(p1)}</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-sky-400/10 text-sky-200 border border-sky-500/30 shadow-sm">🥈 {formatPrize(p2)}</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-violet-400/10 text-violet-200 border border-violet-500/30 shadow-sm">🥉 {formatPrize(p3)}</span>
                      </div>

                      {/* Date once + Time-only chips */}
                      <div className="mt-2">
                        <div className="text-[11px] text-slate-400">{q.start_time ? formatDateOnly(q.start_time) : '—'}</div>
                        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                          <div className="bg-slate-800/50 border border-slate-700 rounded-md px-2 py-1">
                            <span className="uppercase text-[9px] text-slate-400">Start</span>
                            <div>{q.start_time ? formatTimeOnly(q.start_time) : '—'}</div>
                          </div>
                          <div className="bg-slate-800/50 border border-slate-700 rounded-md px-2 py-1">
                            <span className="uppercase text-[9px] text-slate-400">End</span>
                            <div>{q.end_time ? formatTimeOnly(q.end_time) : '—'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Countdown */}
                      {secs !== null && (
                        <div className="mt-2 text-sm font-semibold text-indigo-300">
                          {isUpcoming ? 'Starts in' : 'Ends in'} {Math.floor(secs/60).toString().padStart(2,'0')}:{(secs%60).toString().padStart(2,'0')}
                        </div>
                      )}

                      {/* Engagement summary: single joined shows both joined + pre-joined */}
                      <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                        <span className="inline-flex items-center"><Users className="w-3.5 h-3.5 mr-1" />{joined} joined</span>
                      </div>
                      {progressed !== null && (
                        <div className="mt-2 w-full bg-slate-800/50 border border-slate-700/70 rounded-full h-1 overflow-hidden">
                          <div className="h-1 bg-emerald-500/80" style={{ width: `${progressed}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Bottom action: JOIN/JOINED button; card itself opens lobby */}
                  <div className="mt-3 flex">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (already || !canJoin) navigate(`/quiz/${q.id}`);
                        else handleJoin(q);
                      }}
                      onMouseEnter={() => prefetchRoute('/quiz')}
                      onFocus={() => prefetchRoute('/quiz')}
                      disabled={joiningId === q.id}
                      aria-disabled={joiningId === q.id}
                      className={`relative z-20 pointer-events-auto w-full px-4 py-2.5 rounded-lg text-sm sm:text-base font-extrabold border text-white transition focus:outline-none focus:ring-2 focus:ring-fuchsia-300 overflow-hidden ${joiningId === q.id ? 'opacity-80 cursor-wait' : 'hover:scale-[1.015] active:scale-[0.99] hover:shadow-[0_12px_24px_rgba(139,92,246,0.55)]'} shadow-[0_8px_18px_rgba(139,92,246,0.4)] border-violet-500/40 bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)]`}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {already ? 'JOINED' : (!canJoin ? 'VIEW' : (joiningId === q.id ? 'JOINING…' : 'JOIN'))}
                      </span>
                    </button>
                  </div>
                </div>
              </m.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryQuizzes;
