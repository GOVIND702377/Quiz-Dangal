import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ChevronRight, Search, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data, error } = await supabase.rpc('get_leaderboard', {
          p_period: period,
          limit_rows: 100,
          offset_rows: 0,
        });

        if (error) throw error;
        if (isMounted) {
          setRows(data || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load leaderboard');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [period]);

  const onTabClick = (key) => {
    const params = new URLSearchParams(window.location.search);
    params.set('period', key);
    navigate({ search: params.toString() });
  };

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.username || '').toLowerCase().includes(s));
  }, [rows, search]);

  const myIndex = useMemo(() => {
    if (!userProfile?.id) return -1;
    return rows.findIndex((r) => r.user_id === userProfile.id);
  }, [rows, userProfile]);

  const myRow = myIndex >= 0 ? rows[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  return (
  <div className="relative">
    {/* Dark colorful backdrop (no pure white) */}
  {/* Background inherits from global home-bg */}
    <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 mix-blend-screen [background-image:radial-gradient(circle_at_18%_28%,rgba(99,102,241,0.35),rgba(0,0,0,0)60%),radial-gradient(circle_at_82%_72%,rgba(168,85,247,0.30),rgba(0,0,0,0)65%),radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.18),rgba(0,0,0,0)55%)]" />
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-7">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <motion.div
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
            <motion.img
              src={`${import.meta.env.BASE_URL}Trophy.png`}
              alt="Trophy"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-md select-none"
              onError={(e) => {
                const triedLower = e.currentTarget.getAttribute('data-tried-lower');
                if (!triedLower) {
                  e.currentTarget.setAttribute('data-tried-lower', '1');
                  e.currentTarget.src = `${import.meta.env.BASE_URL}trophy.png`;
                } else {
                  e.currentTarget.src = `${import.meta.env.BASE_URL}android-chrome-512x512.png`;
                }
              }}
              decoding="async"
              loading="eager"
              style={{ zIndex: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
            />
          </motion.div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">Leaderboards</h1>
        </div>
  <p className="text-slate-200/85 text-sm">Top players by performance & consistency</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map(p => (
            <button
              key={p.key}
              onClick={() => onTabClick(p.key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide border transition shadow-sm ${period===p.key? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white border-indigo-500 shadow-lg':'bg-gradient-to-r from-indigo-900/40 via-violet-900/30 to-fuchsia-900/30 text-slate-200 border-indigo-700 hover:from-indigo-800/50 hover:via-violet-800/40 hover:to-fuchsia-800/40 hover:text-white'} `}
            >{p.label}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-100 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search players..."
            className="pl-9 pr-3 h-11 w-full rounded-xl bg-[linear-gradient(120deg,rgba(55,48,163,0.9),rgba(88,28,135,0.85),rgba(134,25,143,0.80))] border border-indigo-400/70 hover:border-indigo-300/80 focus:border-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 text-[13px] font-medium text-slate-50 placeholder:text-slate-300/70 shadow-[0_0_0_1px_rgba(129,140,248,0.45),0_4px_20px_-6px_rgba(0,0,0,0.75)] backdrop-blur-md transition"
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
        </div>
      </div>

      <AnimatePresence>
        {(!loading && !error && rows.length >= 1) && (
          <motion.div layout className="grid grid-cols-3 gap-4">
            {[2,1,3].map((pos, i) => {
              const r = rows[pos-1];
              if (!r) return <div key={i}></div>;
              const heightClass = pos === 1 ? 'h-48' : pos === 2 ? 'h-40' : 'h-36';
              // Metallic style gradients for gold / silver / bronze
              const medalClasses = pos===1
                ? { circle:'bg-[linear-gradient(140deg,#fff9db_0%,#f9e27a_25%,#f6c84f_55%,#f9e27a_75%,#fff9db_100%)] text-amber-800', card:'from-[#72542140] via-[#ffd36b14] to-[#5b3b7a40]', border:'border-amber-300/60' }
                : pos===2
                  ? { circle:'bg-[linear-gradient(145deg,#f5f7fa_0%,#d9e2ec_30%,#c2ccd6_55%,#e4ebf2_85%,#ffffff_100%)] text-slate-700', card:'from-[#42506a40] via-[#bcc7d214] to-[#4a3a7a40]', border:'border-slate-300/50' }
                  : { circle:'bg-[linear-gradient(140deg,#ffe7d0_0%,#ffc891_25%,#f7a350_55%,#ffc891_78%,#ffe7d0_100%)] text-orange-800', card:'from-[#6b3f2640] via-[#ffb77414] to-[#5b367a40]', border:'border-orange-300/50' };
              return (
                <motion.div key={pos} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className={`relative flex items-end justify-center rounded-2xl ${heightClass} overflow-hidden border ${medalClasses.border} bg-gradient-to-br ${medalClasses.card} shadow-xl backdrop-blur-xl`}>  
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
                    <div className="text-[11px] font-semibold tracking-wide text-white max-w-full truncate">{r.username?`@${r.username}`:'Anonymous'}</div>
                    <div className="text-[11px] font-semibold tracking-wider text-slate-100 flex items-center gap-1"><span className="font-mono text-[12px] bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent drop-shadow-sm">{r.leaderboard_score.toFixed(2)}</span><span className="text-slate-200/80">SCORE</span></div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !error && myRow && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 border border-indigo-600/50 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-600 text-white font-bold flex items-center justify-center shadow-lg ring-2 ring-indigo-400/40">{myRank}</div>
              <div>
                <div className="font-semibold text-white text-sm">{myRow.username ? `@${myRow.username}` : 'You'}</div>
                <div className="text-[11px] text-slate-300/85 uppercase tracking-wide">Your Position</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold font-mono bg-gradient-to-r from-indigo-100 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent drop-shadow-sm tracking-tight">{myRow.leaderboard_score.toFixed(2)}</div>
              <div className="text-[11px] font-semibold text-slate-200/95 uppercase tracking-wider drop-shadow">Score</div>
            </div>
          </div>
        </div>
      )}

  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 border border-indigo-700/60 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-24 w-72 h-72 bg-gradient-to-br from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 opacity-40 rounded-full blur-3xl" />
        {loading ? (
          <div className="py-12 flex flex-col items-center text-indigo-300/80">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300 mb-3" />
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-400 font-medium">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-indigo-300/70">No players match your search.</div>
        ) : (
          <motion.div layout className="flex flex-col gap-3">
    {filteredRows.map((r, i) => {
              const rank = r.rank || i + 1;
              const highlight = myRank === rank;
              const top3 = rank <= 3;
              const top10 = rank <= 10;
              const win = Math.min(100, r.win_rate || 0);
              const baseGrad = top3
                ? 'from-amber-400/15 via-yellow-400/5 to-transparent'
                : top10
      ? 'from-indigo-500/20 via-violet-500/10 to-transparent'
      : 'from-indigo-400/5 via-violet-400/5 to-transparent';
              const borderColor = top3
                ? 'border-amber-300/60'
                : top10
                  ? 'border-indigo-300/60'
                  : 'border-gray-200';
              return (
                <motion.div
                  key={rank}
                  initial={{opacity:0,y:8}}
                  animate={{opacity:1,y:0}}
                  layout
                  className={`group relative rounded-xl overflow-hidden border bg-gradient-to-r ${baseGrad} pr-4 transition shadow-sm hover:shadow-lg backdrop-blur-sm ${highlight? 'ring-2 ring-indigo-400/60 border-indigo-400':'hover:border-indigo-500/50'} ${borderColor}`}
                >
      <span className={`absolute inset-y-0 left-0 w-1 ${top3? 'bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-500':'bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-600'} opacity-90`} />
      <span className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-60 transition mix-blend-overlay" style={{background: top3 ? 'radial-gradient(circle_at_70%_35%,rgba(252,211,77,0.4),rgba(0,0,0,0)60%)' : 'linear-gradient(95deg, rgba(99,102,241,0.18), rgba(139,92,246,0.16), rgba(236,72,153,0.14))'}} />
                  {/* Content */}
                  <div className="flex items-center gap-3 flex-1 p-3 pl-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-semibold text-[13px] shadow-lg ${top3? 'bg-[linear-gradient(140deg,#ffe9b0,#f9cf55,#f6b530,#f9cf55,#ffe9b0)] text-amber-900':'bg-[linear-gradient(145deg,#4f46e5,#6d28d9,#9333ea,#c026d3)] text-white'} ${highlight? 'ring-2 ring-indigo-300/60':''}`}>{rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate transition tracking-wide ${highlight? 'text-white':'text-slate-100 group-hover:text-white'}`}>{r.username?`@${r.username}`:'Anonymous'}</div>
                      <div className="mt-1 flex items-center gap-5 text-[11px] text-slate-300/85 font-medium">
                        <span className="flex items-center gap-1"><span className="tabular-nums font-mono">{r.win_rate?.toFixed(1)}%</span></span>
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-fuchsia-200" /> <span className="tabular-nums font-mono">{r.streak || 0}</span></span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-100/40 overflow-hidden ring-1 ring-indigo-100/60">
                        <span style={{width: win + '%'}} className="block h-full rounded-full bg-[linear-gradient(90deg,#4338ca,#6366f1,#8b5cf6,#d946ef)] shadow-[0_0_10px_-1px_rgba(139,92,246,0.65)]" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 text-right text-sm font-bold">
                    <div className="bg-gradient-to-r from-slate-50 via-fuchsia-100 to-violet-100 bg-clip-text text-transparent drop-shadow-sm font-mono tabular-nums tracking-tight">{r.leaderboard_score?.toFixed(2)}</div>
                    <div className="text-[11px] font-semibold text-slate-200/95 tracking-wider drop-shadow">Score</div>
                  </div>
                </motion.div>
              );
            })}
            <div className="flex justify-end text-[11px] uppercase tracking-wide text-indigo-400/70 mt-2 items-center">Showing {filteredRows.length} of {rows.length}<ChevronRight className="w-3 h-3 ml-1" /></div>
          </motion.div>
        )}
      </div>
    </div>
  </div>
  );
}
