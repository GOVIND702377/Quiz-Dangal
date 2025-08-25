import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Calendar } from 'lucide-react';

export default function AdminLeaderboards() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leaderboard_snapshot')
      .select('*')
      .order('snapshot_date', { ascending: false });
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const triggerWeekly = async () => {
    setActing(true);
    try {
      // award + snapshot if both exist, otherwise try take_winners_snapshot only
      const calls = [
        () => supabase.rpc('award_weekly_winners'),
        () => supabase.rpc('take_winners_snapshot'),
      ];
      for (const c of calls) {
        const { error } = await c();
        if (error) throw error;
      }
      toast({ title: 'Weekly snapshot taken' });
      await load();
    } catch (e) {
      toast({ title: 'Weekly failed', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const triggerMonthly = async () => {
    setActing(true);
    try {
      const calls = [
        () => supabase.rpc('award_monthly_winners'),
        () => supabase.rpc('take_winners_snapshot'),
      ];
      for (const c of calls) {
        const { error } = await c();
        if (error) throw error;
      }
      toast({ title: 'Monthly snapshot taken' });
      await load();
    } catch (e) {
      toast({ title: 'Monthly failed', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Crown className="mr-2" /> Admin: Leaderboards
          </h1>
          <p className="text-gray-600 text-sm">Trigger weekly/monthly winners and view snapshots</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={triggerWeekly} disabled={acting} className="bg-indigo-600 hover:bg-indigo-700">Weekly Snapshot</Button>
          <Button onClick={triggerMonthly} disabled={acting} variant="outline">Monthly Snapshot</Button>
          <Button onClick={load} variant="outline">Refresh</Button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No snapshots yet</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-gray-800">{r.full_name}</div>
                  <div className="text-gray-600">{r.period} • Rank {r.rank} • Reward {r.reward_amount}</div>
                </div>
                <div className="text-gray-500 flex items-center"><Calendar className="w-4 h-4 mr-1" /> {new Date(r.snapshot_date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
