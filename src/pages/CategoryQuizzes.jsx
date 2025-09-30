import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDateTime, formatDateOnly, formatTimeOnly } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Clock, Users, Flame, MessageSquare, Brain, Clapperboard } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

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
  if (s.includes('sport')) return { title: 'Sports Quizzes', emoji: '🔥', Icon: Flame, from: 'from-orange-600/30', to: 'to-red-600/30', ring: 'ring-orange-500/30' };
  if (s.includes('movie')) return { title: 'Movie Quizzes', emoji: '🎬', Icon: Clapperboard, from: 'from-violet-600/30', to: 'to-indigo-600/30', ring: 'ring-violet-500/30' };
  return { title: `${slug} Quizzes`, emoji: '⭐', Icon: MessageSquare, from: 'from-sky-600/30', to: 'to-indigo-600/30', ring: 'ring-sky-500/30' };
}

const CategoryQuizzes = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [counts, setCounts] = useState({}); // { [quizId]: joined (pre+joined+completed as joined) }
  const [engagement, setEngagement] = useState({}); // legacy; will be removed
  const [joinedMap, setJoinedMap] = useState({}); // quiz_id -> 'joined' | 'pre'
  const [tick, setTick] = useState(0); // force re-render for live countdown

  const fetchQuizzes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id,title,category,start_time,end_time,status,prize_pool,prizes')
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
      } catch {}
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
    setJoiningId(q.id);
    try {
      // Determine by time window, not stored status
      const now = Date.now();
      const st = q.start_time ? new Date(q.start_time).getTime() : 0;
      const et = q.end_time ? new Date(q.end_time).getTime() : 0;
      const isActive = st && et && now >= st && now < et;
      const isUpcoming = st && now < st;
      const rpc = isUpcoming ? 'pre_join_quiz' : (isActive ? 'join_quiz' : 'pre_join_quiz');
      const { data, error } = await supabase.rpc(rpc, { p_quiz_id: q.id });
      if (error) throw error;
      if (isUpcoming) {
        toast({ title: 'Pre-joined!', description: 'We will remind you before start.' });
      } else {
        toast({ title: 'Joined!', description: 'Taking you to the quiz.' });
        navigate(`/quiz/${q.id}`);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message || 'Could not join quiz.', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  // Local filter: All | Active | Upcoming
  const [filter, setFilter] = useState('all');

  const filtered = quizzes.filter(q => {
    const now = Date.now();
    const st = q.start_time ? new Date(q.start_time).getTime() : 0;
    const et = q.end_time ? new Date(q.end_time).getTime() : 0;
    const isActive = st && et && now >= st && now < et;
    const isUpcoming = st && now < st;
    if (filter === 'all') return isActive || isUpcoming; // hide finished by default
    return filter === 'active' ? isActive : isUpcoming;
  });

  return (
    <div className="container mx-auto px-4 py-3 text-foreground">
      {/* Hero Header */}
      {(() => { const meta = categoryMeta(slug); const Icon = meta.Icon; return (
        <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${meta.from} ${meta.to} mb-4`}>          
          <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(700px 180px at -10% -20%, rgba(255,255,255,0.07), transparent), radial-gradient(420px 100px at 110% 10%, rgba(255,255,255,0.05), transparent)'}} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xl sm:text-2xl" aria-hidden>{meta.emoji}</div>
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{meta.title}</h1>
                  <p className="text-xs text-white/80">Pick an upcoming or live quiz to jump in.</p>
                </div>
              </div>
              <div className={`inline-flex rounded-lg bg-slate-900/60 border border-slate-700/60 overflow-hidden shadow ${meta.ring}`}>
                {['all','active','upcoming'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-2.5 sm:px-3.5 py-1 text-[11px] font-semibold transition ${filter===f?'bg-white/10 text-white':'text-slate-300 hover:bg-white/5'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )})()}

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
            const canJoin = isActive || isUpcoming;
            let label = joiningId === q.id ? 'JOINING…' : (isActive ? 'PLAY' : (isUpcoming ? 'JOIN' : 'SOON'));
            const secs = isUpcoming && st ? Math.max(0, Math.floor((st - now)/1000)) : (isActive && et ? Math.max(0, Math.floor((et - now)/1000)) : null);
            const prizes = Array.isArray(q.prizes) ? q.prizes : [];
            const p1 = prizes[0] || 0, p2 = prizes[1] || 0, p3 = prizes[2] || 0;
            const joined = counts[q.id] || 0;
            const myStatus = joinedMap[q.id];
            let joinDisabled = !canJoin || joiningId === q.id;
            if (isUpcoming && myStatus === 'pre') { label = 'PRE-JOINED'; joinDisabled = true; }
            if (isActive && myStatus === 'joined') { label = 'PLAY'; }
            const totalWindow = (st && et) ? Math.max(1, et - st) : null;
            const progressed = isActive && totalWindow ? Math.min(100, Math.max(0, Math.round(((now - st) / totalWindow) * 100))) : null;
            return (
              <motion.div
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

                {/* Status ribbon */}
                {isActive && (
                  <div className="absolute -left-10 top-3 rotate-[-15deg]">
                    <span className="bg-rose-600 text-white text-[10px] font-extrabold tracking-widest px-6 py-1 rounded shadow-lg ring-1 ring-rose-300/50">LIVE</span>
                  </div>
                )}
                {isUpcoming && (
                  <div className="absolute -left-10 top-3 rotate-[-15deg]">
                    <span className="bg-sky-600 text-white text-[10px] font-extrabold tracking-widest px-6 py-1 rounded shadow-lg ring-1 ring-sky-300/50">SOON</span>
                  </div>
                )}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="truncate font-semibold text-slate-100 text-base sm:text-lg">{q.title}</div>
                        <span className={statusBadge(isActive ? 'active' : (isUpcoming ? 'upcoming' : 'finished'))}>{isActive ? 'active' : (isUpcoming ? 'upcoming' : 'finished')}</span>
                        {myStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${myStatus==='pre'?'bg-indigo-500/15 text-indigo-300 border-indigo-700/40':'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'}`}>
                            {myStatus==='pre'?'Pre-joined':'Joined'}
                          </span>
                        )}
                      </div>

                      {/* Prize Chips (more attractive) */}
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-200 border border-amber-500/30 shadow-sm">🥇 ₹{p1}</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-sky-400/10 text-sky-200 border border-sky-500/30 shadow-sm">🥈 ₹{p2}</span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-violet-400/10 text-violet-200 border border-violet-500/30 shadow-sm">🥉 ₹{p3}</span>
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
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                      <button
                        disabled={joinDisabled}
                        onClick={() => !joinDisabled && handleJoin({ ...q, status: isUpcoming ? 'upcoming' : (isActive ? 'active' : q.status) })}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${joinDisabled ? 'bg-slate-700 text-slate-400 border-slate-700' : (isActive ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-500/20 shadow-lg' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-500/20 shadow-lg')}`}
                      >
                        {label}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryQuizzes;
