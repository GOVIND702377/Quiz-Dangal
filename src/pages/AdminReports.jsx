import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, BarChart3, Activity, TrendingUp, Trophy } from 'lucide-react';

function Card({ title, children, icon: Icon }) {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center mb-3">
        {Icon && <Icon className="w-5 h-5 text-indigo-600 mr-2" />}
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText = 'No data' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-2 py-4 text-center text-gray-500">{emptyText}</td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-gray-800">{c.render ? c.render(r[c.key], r) : r[c.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminReports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dau, setDau] = useState([]);
  const [dailyFlow, setDailyFlow] = useState([]);
  const [weeklyFlow, setWeeklyFlow] = useState([]);
  const [topEarners, setTopEarners] = useState([]);
  const [topSpenders, setTopSpenders] = useState([]);
  const [winners, setWinners] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [d1, d2, d3, d4, d5, d6] = await Promise.all([
        supabase.from('v_daily_active_users').select('*'),
        supabase.from('v_daily_coins_flow').select('*'),
        supabase.from('v_weekly_coins_flow').select('*'),
        supabase.from('v_top_earners').select('*'),
        supabase.from('v_top_spenders').select('*'),
        supabase.from('winners_report').select('*'),
      ]);
      if (d1.error) throw d1.error;
      if (d2.error) throw d2.error;
      if (d3.error) throw d3.error;
      if (d4.error) throw d4.error;
      if (d5.error) throw d5.error;
      if (d6.error) throw d6.error;

      setDau(d1.data || []);
      setDailyFlow(d2.data || []);
      setWeeklyFlow(d3.data || []);
      setTopEarners(d4.data || []);
      setTopSpenders(d5.data || []);
      setWinners(d6.data || []);
    } catch (e) {
      toast({ title: 'Load failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <BarChart3 className="mr-2" /> Admin Reports
          </h1>
          <p className="text-gray-600 text-sm">DAU, coins flow, winners and top lists</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm"
        >Refresh</button>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading reports...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Daily Active Users" icon={Activity}>
            <SimpleTable
              columns={[
                { key: 'day', label: 'Day', render: (v) => new Date(v).toLocaleDateString() },
                { key: 'active_users', label: 'Active Users' },
              ]}
              rows={dau}
              emptyText="No DAU data"
            />
          </Card>

          <Card title="Daily Coins Flow" icon={TrendingUp}>
            <SimpleTable
              columns={[
                { key: 'day', label: 'Day', render: (v) => new Date(v).toLocaleDateString() },
                { key: 'coins_issued', label: 'Issued' },
                { key: 'coins_spent', label: 'Spent' },
                { key: 'coins_refunded', label: 'Refunded' },
              ]}
              rows={dailyFlow}
              emptyText="No daily flow"
            />
          </Card>

          <Card title="Weekly Coins Flow" icon={TrendingUp}>
            <SimpleTable
              columns={[
                { key: 'week_start', label: 'Week Start', render: (v) => new Date(v).toLocaleDateString() },
                { key: 'coins_issued', label: 'Issued' },
                { key: 'coins_spent', label: 'Spent' },
                { key: 'coins_refunded', label: 'Refunded' },
              ]}
              rows={weeklyFlow}
              emptyText="No weekly flow"
            />
          </Card>

          <Card title="Top Earners" icon={Trophy}>
            <SimpleTable
              columns={[
                { key: 'full_name', label: 'Name' },
                { key: 'total_earned', label: 'Total Earned' },
                { key: 'wallet_balance', label: 'Wallet Balance' },
              ]}
              rows={topEarners}
              emptyText="No earners"
            />
          </Card>

          <Card title="Top Spenders" icon={Trophy}>
            <SimpleTable
              columns={[
                { key: 'full_name', label: 'Name' },
                { key: 'total_spent', label: 'Total Spent' },
              ]}
              rows={topSpenders}
              emptyText="No spenders"
            />
          </Card>

          <Card title="Winners Report" icon={Trophy}>
            <SimpleTable
              columns={[
                { key: 'period', label: 'Period' },
                { key: 'rank', label: 'Rank' },
                { key: 'full_name', label: 'Name' },
                { key: 'coins_earned', label: 'Coins' },
                { key: 'reward_amount', label: 'Reward' },
              ]}
              rows={winners}
              emptyText="No winners"
            />
          </Card>
        </div>
      )}
    </div>
  );
}
