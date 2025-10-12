import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SEO from '@/components/SEO';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ChevronRight, Search, Zap } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const periods = [
  { key: 'all_time', label: 'All-time' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// removed old dark variant row component

export default function Leaderboards() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const query = useQuery();
  const period = query.get('period') || 'all_time';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const loadLeaderboard = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase not configured');

      let data = [];
      if (p === 'all_time') {
        const { data: allTime, error: v2Err } = await supabase.rpc('get_all_time_leaderboard_v2', { limit_rows: 100, offset_rows: 0, max_streak_limit: 30 });
        if (!v2Err) {
          data = allTime || [];
        } else {
          const { data: v1Data, error: v1Err } = await supabase.rpc('get_all_time_leaderboard', { limit_rows: 100, offset_rows: 0, max_streak_limit: 30 });
          if (v1Err) throw v1Err;
          data = v1Data || [];
        }
      } else {
        const streakCap = p === 'weekly' ? 7 : 30;
        const { data: v2Data, error: v2Err } = await supabase.rpc('get_leaderboard_v2', { p_period: p, limit_rows: 100, offset_rows: 0, max_streak_limit: streakCap });
        if (!v2Err) {
          data = v2Data || [];
        } else {
          const { data: v1Data, error: v1Err } = await supabase.rpc('get_leaderboard', { p_period: p, limit_rows: 100, offset_rows: 0, max_streak_limit: streakCap });
          if (v1Err) throw v1Err;
          data = v1Data || [];
        }
      }

      setRows(data);
    } catch (err) {
      const errorMessage = err.message || 'Failed to load leaderboard.';
      console.error('Leaderboard fetch error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard(period);
  }, [period, loadLeaderboard]);

  const onTabClick = (key) => {
    navigate(`?period=${key}`);
  };

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.username || r.full_name || '').toLowerCase().includes(s));
  }, [rows, search]);

  const myIndex = useMemo(() => {
    if (!userProfile?.id) return -1;
    return rows.findIndex((r) => r.user_id === userProfile.id);
  }, [rows, userProfile]);

  const myRow = myIndex >= 0 ? rows[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <div className="relative">
      <SEO
        title="Leaderboards – Quiz Dangal | Top Quiz Players"
        description="See the top players on Quiz Dangal leaderboards. Compete in daily opinion and knowledge quizzes, win coins, and climb ranks."
  canonical="https://quizdangal.com/leaderboards"
        keywords={[ 'quiz leaderboard','top quiz players','quizdangal leaderboard','daily quiz rankings' ]}
      />
      {/* Dark colorful backdrop (no pure white) */}
      {/* Background inherits from global home-bg */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 mix-blend-screen [background-image:radial-gradient(circle_at_18%_28%,rgba(99,102,241,0.35),rgba(0,0,0,0)60%),radial-gradient(circle_at_82%_72%,rgba(168,85,247,0.30),rgba(0,0,0,0)65%),radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.18),rgba(0,0,0,0)55%)]" />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-7">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <m.div
            className="relative w-8 h-8 shrink-0"
            initial={{ rotate: -3, y: 0 }}
            animate={{ rotate: [-3, 3, -3], y: [0, -2, 0] }}
            transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,215,0,0.35),rgba(0,0,0,0))] blur-[2px]"
              style={{ zIndex: 0 }}
            />
            <m.img
              src={`${import.meta.env.BASE_URL}Trophy.png`}
              alt="Trophy"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-md select-none"
              onError={(e) => {
                // Fallback to app icon if trophy image fails (e.g., CDN/cache issue)
                e.currentTarget.src = `${import.meta.env.BASE_URL}android-chrome-512x512.png`;
              }}
              decoding="async"
              loading="eager"
              style={{ zIndex: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
            />
          </m.div>
          <h1 className="text-3xl font-extrabold text-white text-shadow tracking-tight">Leaderboards</h1>
        </div>
  <p className="text-slate-200/85 text-sm">Top players by performance & consistency</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map(p => (
              <button
              key={p.key}
              onClick={() => onTabClick(p.key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide border transition shadow-sm ${period===p.key? 'bg-accent-b text-white border-accent-b shadow':'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-800'} `}
            >{p.label}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-100 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search players..."
            className="pl-9 pr-3 h-11 w-full rounded-xl bg-slate-800/80 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base sm:text-[13px] font-medium text-slate-100 placeholder:text-slate-400 shadow"
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
        </div>
      </div>

      <AnimatePresence>
        {(!loading && !error && rows.length >= 1) && (
          <m.div layout className="grid grid-cols-3 gap-4">
            {[2,1,3].map((pos, i) => {
              const r = rows[pos-1];
              if (!r) return <div key={`podium-empty-${i}`}></div>;
              const heightClass = pos === 1 ? 'h-48' : pos === 2 ? 'h-40' : 'h-36';
              // Metallic style gradients for gold / silver / bronze
              const medalClasses = pos===1
                ? { circle:'bg-[linear-gradient(140deg,#fff9db_0%,#f9e27a_25%,#f6c84f_55%,#f9e27a_75%,#fff9db_100%)] text-amber-800', card:'from-[#72542140] via-[#ffd36b14] to-[#5b3b7a40]', border:'border-amber-300/60' }
                : pos===2
                  ? { circle:'bg-[linear-gradient(145deg,#f5f7fa_0%,#d9e2ec_30%,#c2ccd6_55%,#e4ebf2_85%,#ffffff_100%)] text-slate-700', card:'from-[#42506a40] via-[#bcc7d214] to-[#4a3a7a40]', border:'border-slate-300/50' }
                  : { circle:'bg-[linear-gradient(140deg,#ffe7d0_0%,#ffc891_25%,#f7a350_55%,#ffc891_78%,#ffe7d0_100%)] text-orange-800', card:'from-[#6b3f2640] via-[#ffb77414] to-[#5b367a40]', border:'border-orange-300/50' };
              return (
                <m.div key={pos} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className={`relative flex items-end justify-center rounded-2xl ${heightClass} overflow-hidden border ${medalClasses.border} bg-slate-800/80 shadow-xl`}>
                  {/* sheen */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-1/3 left-1/4 w-2/3 h-full rotate-12 bg-gradient-to-b from-white/25 via-transparent to-transparent opacity-40" />
                    <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(circle_at_65%_25%,rgba(124,58,237,0.55),rgba(255,255,255,0)_60%)]" />
                  </div>
                  <div className="relative w-full p-3 flex flex-col items-center gap-2">
                    {pos === 1 ? (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)] ring-2 ring-indigo-300/50 backdrop-blur ${medalClasses.circle}`}>🥇</div>
                    ) : (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)] ring-2 ring-indigo-300/50 backdrop-blur ${medalClasses.circle}`}>{pos===2?'🥈':'🥉'}</div>
                    )}
                    <div className="text-[11px] font-semibold tracking-wide text-white max-w-full truncate">{r.username?`@${r.username}`:(r.full_name || 'Anonymous')}</div>
                    <div className="text-[11px] font-semibold tracking-wider text-slate-100 flex items-center gap-1"><span className="font-mono text-[12px] bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent drop-shadow-sm">{(r.leaderboard_score ?? 0).toFixed(2)}</span><span className="text-slate-200/80">SCORE</span></div>
                  </div>
                </m.div>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>

      {!loading && !error && myRow && (
  <div className="p-4 rounded-2xl qd-card shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-600 text-white font-bold flex items-center justify-center shadow-lg ring-2 ring-indigo-400/40">{myRank}</div>
              <div>
                <div className="font-semibold text-white text-sm">{myRow.username ? `@${myRow.username}` : (myRow.full_name || 'You')}</div>
                <div className="text-[11px] text-slate-300/85 uppercase tracking-wide">Your Position</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold font-mono bg-gradient-to-r from-indigo-100 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent drop-shadow-sm tracking-tight">{Number(myRow.leaderboard_score ?? 0).toFixed(2)}</div>
              <div className="text-[11px] font-semibold text-slate-200/95 uppercase tracking-wider drop-shadow">Score</div>
            </div>
          </div>
        </div>
      )}

  <div className="p-4 rounded-2xl qd-card shadow-xl relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-24 w-72 h-72 bg-gradient-to-br from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 opacity-40 rounded-full blur-3xl" />
        {loading ? (
          <div className="py-12 flex flex-col items-center text-indigo-300/80">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300 mb-3" />
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <div className="text-red-400 font-medium mb-3">{error}</div>
            <button onClick={() => loadLeaderboard(period)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700">Retry</button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-indigo-200/80">
            {search.trim() ? (
              <>No players match your search.</>
            ) : (
              <div className="space-y-3">
                <div>No leaderboard data yet for this period.</div>
                <div className="text-indigo-100/80 text-sm">Tips: Choose All-time, ensure quizzes are finished and results computed, or tap refresh.</div>
                <div>
                  <button onClick={() => loadLeaderboard(period)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700">Refresh</button>
                </div>
              </div>
            )}
          </div>
        ) : (
      <m.div layout className="flex flex-col gap-3">
    {(showAll ? filteredRows : filteredRows.slice(0, 5)).map((r, i) => {
              const rank = r.rank || i + 1;
              const highlight = myRank === rank;
              const top3 = rank <= 3; // removed unused top10 variable
              const win = Math.min(100, r.win_rate || 0);
              // removed unused baseGrad & borderColor variables
              const name = r.username ? `@${r.username}` : (r.full_name || 'Anonymous');
              return (
                <m.div
                  key={r.user_id || `row-${rank}-${i}`}
                  initial={{opacity:0,y:8}}
                  animate={{opacity:1,y:0}}
                  layout
                  className={`group relative rounded-xl overflow-hidden border pr-4 transition shadow-sm hover:shadow-lg ${highlight? 'ring-2 ring-indigo-400/60 border-indigo-400':'border-slate-700'} bg-slate-800/70`}
                >
      <span className={`absolute inset-y-0 left-0 w-1 ${top3? 'bg-amber-400':'bg-indigo-500'} opacity-90`} />
      <span className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-60 transition mix-blend-overlay" style={{background: top3 ? 'radial-gradient(circle_at_70%_35%,rgba(252,211,77,0.4),rgba(0,0,0,0)60%)' : 'linear-gradient(95deg, rgba(99,102,241,0.18), rgba(139,92,246,0.16), rgba(236,72,153,0.14))'}} />
                  {/* Content */}
                  <div className="flex items-center gap-3 flex-1 p-3 pl-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-[13px] shadow-lg ${top3? 'bg-amber-400 text-amber-900':'bg-indigo-600 text-white'} ${highlight? 'ring-2 ring-indigo-300/60':''}`}>{rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate transition tracking-wide ${highlight? 'text-white':'text-slate-100 group-hover:text-white'}`}>{name}</div>
                      <div className="mt-1 flex items-center gap-5 text-[11px] text-slate-300/85 font-medium">
                        <span className="flex items-center gap-1"><span className="tabular-nums font-mono">{Number(r.win_rate ?? 0).toFixed(1)}%</span></span>
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-fuchsia-200" /> <span className="tabular-nums font-mono">{r.streak || 0}</span></span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-100/40 overflow-hidden ring-1 ring-indigo-100/60">
                        <span style={{width: win + '%'}} className="block h-full rounded-full bg-[linear-gradient(90deg,#4338ca,#6366f1,#8b5cf6,#d946ef)] shadow-[0_0_10px_-1px_rgba(139,92,246,0.65)]" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 text-right text-sm font-bold">
                    <div className="bg-gradient-to-r from-slate-50 via-fuchsia-100 to-violet-100 bg-clip-text text-transparent drop-shadow-sm font-mono tabular-nums tracking-tight">{Number(r.leaderboard_score ?? 0).toFixed(2)}</div>
                    <div className="text-[11px] font-semibold text-slate-200/95 tracking-wider drop-shadow">Score</div>
                  </div>
                </m.div>
              );
            })}
            {filteredRows.length > 5 && (
              <div className="mt-2 flex justify-center">
                {!showAll ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800 shadow-sm"
                    aria-label="Show more ranks"
                  >
                    Show more <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800 shadow-sm"
                    aria-label="Show less ranks"
                  >
                    Show less
                  </button>
                )}
              </div>
            )}
          </m.div>
        )}
      </div>
    </div>
  </div>
  );
}
