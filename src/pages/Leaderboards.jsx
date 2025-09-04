import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Trophy, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const periods = [
  { key: 'all', label: 'All-time' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function LeaderboardRow({ rank, name, level, coins, referrals, streak, badges, highlight = false }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl bg-white/80 border ${highlight ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200/50'} shadow-sm hover:shadow-md transition`}>
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
          rank === 1 ? 'bg-yellow-100 text-yellow-700' : rank === 2 ? 'bg-gray-100 text-gray-700' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-700'
        }`}>{medal}</div>
        <div className="min-w-0">
        <div className="font-semibold text-gray-800 truncate max-w-[160px] sm:max-w-[240px]">{name ? `@${name}` : 'Anonymous'}</div>
        <div className="text-xs text-gray-500">Streak: {streak || 0}</div>
        </div>
      </div>
      <div className="flex items-center space-x-6 text-sm">
        <div className="text-right">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">🪙 {coins}</div>
        </div>
                <div className="text-right hidden sm:block">
          <div className="text-gray-900 font-semibold">{streak ?? 0}</div>
          <div className="text-gray-500 text-xs">Streak</div>
        </div>
        <div className="hidden md:flex items-center space-x-1 text-xs text-indigo-600">
          {Array.isArray(badges) && badges.slice(0, 3).map((b, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">{b}</span>
          ))}
          {Array.isArray(badges) && badges.length > 3 && (
            <span className="text-gray-500">+{badges.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Leaderboards() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const query = useQuery();
  const period = query.get('period') || 'all';
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
        let data = [];
        if (period === 'weekly') {
          const { data: d, error: e } = await supabase
            .from('leaderboard_weekly')
            .select('*');
          if (e) throw e;
          data = d || [];
          // Sort by coins_earned desc
          data.sort((a, b) => Number(b.coins_earned || 0) - Number(a.coins_earned || 0));
          // Map to unified shape
          data = data.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            name: r.username,
            level: r.level,
            coins: Number(r.coins_earned || 0),
            referrals: undefined,
            streak: Number(r.current_streak || 0),
            badges: r.badges,
          }));
        } else if (period === 'monthly') {
          const { data: d, error: e } = await supabase
            .from('leaderboard_monthly')
            .select('*');
          if (e) throw e;
          data = d || [];
          data.sort((a, b) => Number(b.coins_earned || 0) - Number(a.coins_earned || 0));
          data = data.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            name: r.username,
            level: r.level,
            coins: Number(r.coins_earned || 0),
            referrals: undefined,
            streak: Number(r.current_streak || 0),
            badges: r.badges,
          }));
        } else {
          // all-time
          // Prefer materialized view data via view all_time_leaderboard
          const { data: d, error: e } = await supabase
            .from('all_time_leaderboard')
            .select('*');
          if (e) throw e;
          data = d || [];
          // Default sort by grand_total if present, else coins_earned
          data.sort((a, b) => Number(b.grand_total || b.coins_earned || 0) - Number(a.grand_total || a.coins_earned || 0));
          data = data.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            name: r.username,
            level: r.level,
            coins: Number((r.grand_total ?? r.coins_earned) || 0),
            referrals: undefined,
            streak: Number(r.current_streak || 0),
            badges: r.badges,
          }));
        }
        if (isMounted) setRows(data.slice(0, 100));
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
    return rows.filter((r) => (r.name || '').toLowerCase().includes(s));
  }, [rows, search]);

  const myIndex = useMemo(() => {
    if (!userProfile?.id) return -1;
    
    // First try to match by user ID
    let index = rows.findIndex((r) => r.user_id === userProfile.id);
    
    // If not found, try matching by username
    if (index === -1 && userProfile.username) {
      index = rows.findIndex((r) => r.name === userProfile.username);
    }
    
    // If still not found, try matching by full name
    if (index === -1) {
      const myName = (userProfile?.full_name || '').toLowerCase().trim();
      if (myName) {
        index = rows.findIndex((r) => (r.name || '').toLowerCase().trim() === myName);
      }
    }
    
    return index;
  }, [rows, userProfile]);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Trophy className="mr-2" /> Leaderboards
          </h1>
          <p className="text-gray-600 text-sm">Top players by coins and activity</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => onTabClick(p.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                period === p.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="pl-9 pr-3 py-2 rounded-full border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm w-full sm:w-64"
          />
        </div>
      </div>

      {/* Podium for top 3 */}
      {!loading && !error && rows.length >= 1 && (
        <div className="grid grid-cols-3 gap-3">
          {[2,1,3].map((pos, idx) => {
            const r = rows[pos-1];
            if (!r) return <div key={idx}></div>;
            const isGold = pos === 1; const isSilver = pos === 2; const isBronze = pos === 3;
            return (
              <div key={pos} className={`rounded-2xl p-4 text-center shadow bg-white/80 border ${isGold?'border-yellow-200':'border-gray-200/60'}`}>
                <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${isGold?'bg-yellow-100 text-yellow-700':isSilver?'bg-gray-100 text-gray-700':'bg-orange-100 text-orange-700'}`}>{pos===1?'🥇':pos===2?'🥈':'🥉'}</div>
                <div className="mt-2 font-semibold text-gray-800 truncate">{r.name ? `@${r.name}` : 'Anonymous'}</div>
                <div className="text-xs text-gray-500">Coins: {r.coins} • Streak: {r.streak || 0}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Rank */}
      {!loading && !error && myRow && (
        <div className="rounded-2xl p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">{myRank}</div>
              <div>
                <div className="font-semibold text-gray-800">{myRow.name ? `@${myRow.name}` : 'You'}</div>
                <div className="text-xs text-gray-500">Your position</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🪙 {myRow.coins}</div>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg mt-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-gray-600">No data available</div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((r) => (
              <LeaderboardRow key={r.rank} {...r} highlight={myRank === r.rank} />
            ))}
            <div className="flex justify-end text-xs text-gray-500 mt-2">
              Showing {filteredRows.length} of {rows.length}
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
