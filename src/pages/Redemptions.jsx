import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Receipt } from 'lucide-react';

export default function Redemptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('redemptions')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false });
      if (!mounted) return;
      if (error) {
        // silently fail to keep minimal UI
      }
      setRows(data || []);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Receipt className="mr-2" /> My Redemptions
          </h1>
          <p className="text-gray-600 text-sm">Track your reward requests</p>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No redemptions yet</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-gray-800">{r.reward_type}: {r.reward_value}</div>
                  <div className="text-gray-500">Coins: {r.coins_required}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  r.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {r.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
