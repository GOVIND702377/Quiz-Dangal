import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Clock, Users, Trophy, Settings, Copy, Database, HelpCircle, Loader2, Search, ShieldCheck, Check, XCircle, Crown, Calendar, BarChart3, Activity, TrendingUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

// ---- Embedded Sections ----
function AdminUsersSection() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Users className="mr-2" /> Admin: Users
          </h2>
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

function AdminRedemptionsSection() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_pending_redemptions')
      .select('*');
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tryApprove = async (id) => {
    const tries = [
      () => supabase.rpc('approve_redemption', { redemption_id: id }),
      () => supabase.rpc('approve_redemption', { p_redemption_id: id }),
      () => supabase.rpc('approve_redemption', { id }),
    ];
    let lastError = null;
    for (const t of tries) {
      const { error } = await t();
      if (!error) return { ok: true };
      lastError = error;
    }
    return { ok: false, error: lastError };
  };

  const tryReject = async (id, reason) => {
    const tries = [
      () => supabase.rpc('reject_redemption', { redemption_id: id, reason }),
      () => supabase.rpc('reject_redemption', { p_redemption_id: id, p_reason: reason }),
      () => supabase.rpc('reject_redemption', { id, reason }),
    ];
    let lastError = null;
    for (const t of tries) {
      const { error } = await t();
      if (!error) return { ok: true };
      lastError = error;
    }
    return { ok: false, error: lastError };
  };

  const handleApprove = async (id) => {
    setActingId(id);
    const res = await tryApprove(id);
    if (!res.ok) {
      toast({ title: 'Approve failed', description: res.error?.message || 'RPC error', variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: 'Redemption approved' });
      await load();
    }
    setActingId(null);
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (optional):', '');
    if (reason === null) return;
    setActingId(id);
    const res = await tryReject(id, reason || '');
    if (!res.ok) {
      toast({ title: 'Reject failed', description: res.error?.message || 'RPC error', variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Redemption rejected' });
      await load();
    }
    setActingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <ShieldCheck className="mr-2" /> Admin: Pending Redemptions
          </h2>
          <p className="text-gray-600 text-sm">Approve or reject pending requests</p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No pending redemptions</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-gray-800">{r.full_name}</div>
                  <div className="text-gray-600">{r.reward_type}: {r.reward_value}</div>
                  <div className="text-gray-500">Coins: {r.coins_required} • Requested: {new Date(r.requested_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button onClick={() => handleApprove(r.id)} disabled={actingId === r.id} className="bg-green-600 hover:bg-green-700" size="sm">
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button onClick={() => handleReject(r.id)} disabled={actingId === r.id} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" size="sm">
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLeaderboardsSection() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Crown className="mr-2" /> Admin: Leaderboards
          </h2>
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

function AdminReportsSection() {
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

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <BarChart3 className="mr-2" /> Admin Reports
          </h2>
          <p className="text-gray-600 text-sm">DAU, coins flow, winners and top lists</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm">Refresh</button>
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

export default function Admin() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'overview';
  const setTab = (key) => {
    const p = new URLSearchParams(params);
    p.set('tab', key);
    setParams(p, { replace: false });
  };
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [showSQLCommands, setShowSQLCommands] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState('');

  // Quiz form state
  const [quizForm, setQuizForm] = useState({
    title: '',
    entry_fee: '',
    prizes: ['', '', ''],
    start_time: '',
    end_time: '',
    result_time: '',
    category: ''
  });

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    options: ['', '', '', '']
  });

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchQuizzes();
    }
  }, [activeTab]);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch quizzes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      const prizesArray = quizForm.prizes.filter(p => p).map(p => parseInt(p));
      const prizePool = prizesArray.reduce((sum, prize) => sum + prize, 0);

      const { data, error } = await supabase
        .from('quizzes')
        .insert([{
          title: quizForm.title,
          entry_fee: parseFloat(quizForm.entry_fee),
          prize_pool: prizePool,
          prizes: prizesArray,
          start_time: quizForm.start_time,
          end_time: quizForm.end_time,
          result_time: quizForm.result_time,
          status: 'upcoming',
          category: quizForm.category || null
        }])
        .select();

      if (error) throw error;

      const newQuizId = data[0].id;
      
      // Generate SQL commands for questions
      generateSQLCommands(newQuizId, quizForm.title);

      toast({
        title: "Success",
        description: "Quiz created successfully! Check SQL commands to add questions.",
      });

      setShowCreateQuiz(false);
      setShowSQLCommands(true);
      setQuizForm({
        title: '',
        entry_fee: '',
        prizes: ['', '', ''],
        start_time: '',
        end_time: '',
        result_time: ''
      });
      fetchQuizzes();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const generateSQLCommands = (quizId, quizTitle) => {
    const sql = `-- SQL Commands for Quiz: ${quizTitle}
-- Quiz ID: ${quizId}

-- Step 1: Add Questions
INSERT INTO questions (quiz_id, question_text) VALUES
('${quizId}', 'Your question 1 here?'),
('${quizId}', 'Your question 2 here?'),
('${quizId}', 'Your question 3 here?'),
('${quizId}', 'Your question 4 here?'),
('${quizId}', 'Your question 5 here?');

-- Step 2: Get Question IDs
SELECT id, question_text FROM questions WHERE quiz_id = '${quizId}';

-- Step 3: Add Options (Replace QUESTION_ID_X with actual IDs from Step 2)
INSERT INTO options (question_id, option_text) VALUES
-- For Question 1
('QUESTION_ID_1', 'Option A'),
('QUESTION_ID_1', 'Option B'),
('QUESTION_ID_1', 'Option C'),
('QUESTION_ID_1', 'Option D'),

-- For Question 2
('QUESTION_ID_2', 'Option A'),
('QUESTION_ID_2', 'Option B'),
('QUESTION_ID_2', 'Option C'),
('QUESTION_ID_2', 'Option D');

-- Continue for all questions...

-- Step 4: Verify Setup
SELECT 
  q.question_text,
  array_agg(o.option_text ORDER BY o.id) as options
FROM questions q
LEFT JOIN options o ON q.id = o.question_id
WHERE q.quiz_id = '${quizId}'
GROUP BY q.id, q.question_text
ORDER BY q.id;`;

    setGeneratedSQL(sql);
  };

  const fetchQuestions = async (quizId) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          options (
            id,
            option_text
          )
        `)
        .eq('quiz_id', quizId);

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch questions.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "SQL commands copied to clipboard.",
    });
  };

  const deleteQuiz = async (quizId) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Quiz deleted successfully!",
      });
      fetchQuizzes();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Temporary: Allow admin access for testing
  // if (userProfile?.role !== 'admin') {
  //   return (
  //     <div className="container mx-auto px-4 py-8 text-center">
  //       <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
  //       <p className="text-gray-600 mt-2">You don't have admin privileges.</p>
  //     </div>
  //   );
  // }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Quiz Dangal Admin
        </h1>
        <p className="text-gray-600">Admin dashboard</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { key: 'overview', title: 'Overview' },
          { key: 'users', title: 'Users' },
          { key: 'redemptions', title: 'Redemptions' },
          { key: 'leaderboards', title: 'Leaderboards' },
          { key: 'reports', title: 'Reports' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${t.key === activeTab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          >
            {t.title}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">{quizzes.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Active Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">
                {quizzes.filter(q => q.status === 'active').length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Upcoming Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">
                {quizzes.filter(q => q.status === 'upcoming').length}
              </p>
            </div>
          </div>
        </motion.div>
  </div>

      {/* Create Quiz Button */}
      <div className="mb-6">
        <Button
          onClick={() => setShowCreateQuiz(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Quiz
        </Button>
      </div>

      {/* Create Quiz Form */}
      {showCreateQuiz && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg mb-8"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Quiz</h2>
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Quiz Title</Label>
                <Input
                  id="title"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({...quizForm, title: e.target.value})}
                  placeholder="Daily Opinion Quiz - Evening"
                  required
                />
              </div>
              <div>
                <Label htmlFor="entry_fee">Entry Fee (₹)</Label>
                <Input
                  id="entry_fee"
                  type="number"
                  step="0.01"
                  value={quizForm.entry_fee}
                  onChange={(e) => setQuizForm({...quizForm, entry_fee: e.target.value})}
                  placeholder="11.00"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Prize Distribution (₹)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="1st Prize (251)"
                  value={quizForm.prizes[0]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[0] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
                <Input
                  placeholder="2nd Prize (151)"
                  value={quizForm.prizes[1]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[1] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
                <Input
                  placeholder="3rd Prize (51)"
                  value={quizForm.prizes[2]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[2] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={quizForm.start_time}
                  onChange={(e) => setQuizForm({...quizForm, start_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={quizForm.end_time}
                  onChange={(e) => setQuizForm({...quizForm, end_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="result_time">Result Time</Label>
                <Input
                  id="result_time"
                  type="datetime-local"
                  value={quizForm.result_time}
                  onChange={(e) => setQuizForm({...quizForm, result_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={quizForm.category}
                  onChange={(e) => setQuizForm({ ...quizForm, category: e.target.value })}
                  placeholder="e.g., GK, Sports, Movies, Opinion"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Create Quiz & Generate SQL
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateQuiz(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* SQL Commands Display */}
      {showSQLCommands && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 text-green-400 rounded-2xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Database className="mr-2" />
              SQL Commands to Run in Supabase
            </h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => copyToClipboard(generatedSQL)}
                variant="outline"
                size="sm"
                className="text-green-400 border-green-400"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button
                onClick={() => setShowSQLCommands(false)}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-400"
              >
                Close
              </Button>
            </div>
          </div>
          <pre className="bg-black p-4 rounded-lg overflow-x-auto text-sm">
            <code>{generatedSQL}</code>
          </pre>
          <div className="mt-4 p-4 bg-yellow-900/50 rounded-lg">
            <h3 className="font-bold text-yellow-400 mb-2 flex items-center">
              <HelpCircle className="mr-2 h-4 w-4" />
              Instructions:
            </h3>
            <ol className="list-decimal list-inside text-yellow-200 space-y-1 text-sm">
              <li>Copy the SQL commands above</li>
              <li>Go to Supabase Dashboard → SQL Editor</li>
              <li>Paste and run Step 1 (Add Questions)</li>
              <li>Run Step 2 to get Question IDs</li>
              <li>Replace QUESTION_ID_X with actual IDs in Step 3</li>
              <li>Run Step 3 to add options</li>
              <li>Run Step 4 to verify everything is set up</li>
            </ol>
          </div>
        </motion.div>
      )}

      {/* Quizzes List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800">All Quizzes</h2>
        {loading ? (
          <div className="py-8 text-center text-gray-600">
            <Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2" /> Loading quizzes...
          </div>
        ) : quizzes.map((quiz, index) => (
          <motion.div
            key={quiz.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">{quiz.title}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>Entry: ₹{quiz.entry_fee}</span>
                  <span>Prize Pool: ₹{quiz.prize_pool}</span>
                  <span>Prizes: ₹{quiz.prizes?.join(', ₹')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    quiz.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    quiz.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {quiz.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  <span>Start: {new Date(quiz.start_time).toLocaleString()}</span>
                  <span className="ml-4">End: {new Date(quiz.end_time).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedQuiz(quiz);
                    fetchQuestions(quiz.id);
                    setShowQuestions(true);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Settings className="h-4 w-4" />
                  Questions
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    generateSQLCommands(quiz.id, quiz.title);
                    setShowSQLCommands(true);
                  }}
                  className="text-green-600 hover:text-green-700"
                >
                  <Database className="h-4 w-4" />
                  SQL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteQuiz(quiz.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      </>
      )}

      {activeTab === 'users' && <AdminUsersSection />}
      {activeTab === 'redemptions' && <AdminRedemptionsSection />}
      {activeTab === 'leaderboards' && <AdminLeaderboardsSection />}
      {activeTab === 'reports' && <AdminReportsSection />}
    </div>
  );
}
