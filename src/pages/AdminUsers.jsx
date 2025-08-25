import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, Search } from 'lucide-react';

export default function AdminUsers() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState('grand_total');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('all_time_leaderboard')
        .select('*');
      if (!mounted) return;
      if (error) {
        toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = rows.filter(r => (r.full_name || '').toLowerCase().includes(needle));
    }
    list = [...list].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
    return list.slice(0, 200);
  }, [rows, q, sortKey]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Users className="mr-2" /> Admin: Users
          </h1>
          <p className="text-gray-600 text-sm">Top users overview (from all-time leaderboard)</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center mb-3 gap-3">
          <div className="flex items-center px-3 py-2 border rounded-lg bg-white">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name"
              className="outline-none text-sm"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white text-sm"
          >
            <option value="grand_total">Sort: Grand Total</option>
            <option value="coins_earned">Sort: Coins Earned</option>
            <option value="coins_spent">Sort: Coins Spent</option>
          </select>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Coins Earned</th>
                  <th className="px-2 py-2">Coins Spent</th>
                  <th className="px-2 py-2">Referrals</th>
                  <th className="px-2 py-2">Streak</th>
                  <th className="px-2 py-2">Badges</th>
                  <th className="px-2 py-2">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-2 text-gray-800">{r.full_name || 'Anonymous'}</td>
                    <td className="px-2 py-2">{Number(r.coins_earned || 0)}</td>
                    <td className="px-2 py-2">{Number(r.coins_spent || 0)}</td>
                    <td className="px-2 py-2">{Number(r.referrals || 0)}</td>
                    <td className="px-2 py-2">{Number(r.streak_count || 0)}</td>
                    <td className="px-2 py-2">{Array.isArray(r.badges) ? r.badges.length : 0}</td>
                    <td className="px-2 py-2 font-semibold">{Number(r.grand_total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
