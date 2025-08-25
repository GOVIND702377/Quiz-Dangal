import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Trophy, ChevronRight } from 'lucide-react';

const periods = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All-time' },
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function LeaderboardRow({ rank, name, level, coins, referrals, streak, badges }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-gray-200/50">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
          rank === 1 ? 'bg-yellow-100 text-yellow-700' : rank === 2 ? 'bg-gray-100 text-gray-700' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-700'
        }`}>{medal}</div>
        <div>
          <div className="font-semibold text-gray-800">{name || 'Anonymous'}</div>
          <div className="text-xs text-gray-500">Level: {level || '—'}</div>
        </div>
      </div>
      <div className="flex items-center space-x-6 text-sm">
        <div className="text-right">
          <div className="text-gray-900 font-semibold">{coins}</div>
          <div className="text-gray-500 text-xs">Coins</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-gray-900 font-semibold">{referrals ?? 0}</div>
          <div className="text-gray-500 text-xs">Referrals</div>
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
  const query = useQuery();
  const period = query.get('period') || 'weekly';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
            name: r.full_name,
            level: r.level,
            coins: Number(r.coins_earned || 0),
            referrals: Number(r.referrals || 0),
            streak: Number(r.streak_count || 0),
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
            name: r.full_name,
            level: r.level,
            coins: Number(r.coins_earned || 0),
            referrals: Number(r.referrals || 0),
            streak: Number(r.streak_count || 0),
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
            name: r.full_name,
            level: r.level,
            coins: Number((r.grand_total ?? r.coins_earned) || 0),
            referrals: Number(r.referrals || 0),
            streak: Number(r.streak_count || 0),
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

      <div className="flex items-center space-x-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => onTabClick(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
              period === p.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
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
            {rows.map((r) => (
              <LeaderboardRow key={r.rank} {...r} />
            ))}
            <div className="flex justify-end text-xs text-gray-500 mt-2">
              Showing top {rows.length}
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
