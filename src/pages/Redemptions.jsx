import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Receipt, Gift, CheckCircle2, Clock, XCircle, Coins, Wallet as WalletIcon, Search, Sparkles, PartyPopper, ArrowRight, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function Redemptions() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardQuery, setRewardQuery] = useState('');
  const [rewardFilter, setRewardFilter] = useState('all'); // all | new
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemStep, setRedeemStep] = useState('confirm'); // confirm | success
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('rewards'); // rewards | history
  const [historyQuery] = useState(''); // removed setter (unused)
  const [historySort] = useState('newest'); // removed setter (unused)
  

  const loadRedemptions = useCallback(async () => {
    if (!user || !hasSupabaseConfig || !supabase) return;
    setLoading(true);
    const res = await supabase
      .from('redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRows(res.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user || !hasSupabaseConfig || !supabase) return;
    const run = async () => { await loadRedemptions(); };
    run();
    const interval = setInterval(run, 15000);
    return () => { clearInterval(interval); };
  }, [user, loadRedemptions]);

  // Load available rewards from backend catalog (reward_catalog)
  useEffect(() => {
    async function loadRewards() {
      if (!hasSupabaseConfig || !supabase) {
        setRewards([]);
        setRewardsLoading(false);
        return;
      }
      setRewardsLoading(true);
      const res2 = await supabase
        .from('reward_catalog')
        .select('*')
        .eq('is_active', true)
        .order('coins_required', { ascending: true })
        .order('id', { ascending: false });
      if (res2.error) setRewards([]); else setRewards(res2.data || []);
      setRewardsLoading(false);
    }
    loadRewards();
  }, []);

  const walletCoins = useMemo(() => Number(userProfile?.wallet_balance || 0), [userProfile]);

  const filteredRewards = useMemo(() => {
    const q = rewardQuery.trim().toLowerCase();
    const twoWeeks = 1000 * 60 * 60 * 24 * 14;
    const now = Date.now();
    return (rewards || [])
      .filter((rw) => {
        const title = String(rw.title || rw.reward_type || '').toLowerCase();
        const desc = String(rw.description || '').toLowerCase();
        const matchesQuery = q ? title.includes(q) || desc.includes(q) : true;
        const createdAt = rw.created_at ? new Date(rw.created_at).getTime() : 0;
        const isNew = createdAt && now - createdAt <= twoWeeks;
        if (rewardFilter === 'new') return matchesQuery && isNew;
        return matchesQuery;
      });
  }, [rewards, rewardQuery, rewardFilter]);

  // History filters and sorting
  const filteredRows = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    let list = rows || [];
    if (q) {
      list = list.filter(r =>
        String(r.reward_type || '').toLowerCase().includes(q) ||
        String(r.reward_value || '').toLowerCase().includes(q) ||
        String(r.status || '').toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const at = a.requested_at ? new Date(a.requested_at).getTime() : 0;
      const bt = b.requested_at ? new Date(b.requested_at).getTime() : 0;
      return historySort === 'oldest' ? at - bt : bt - at;
    });
    return list;
  }, [rows, historyQuery, historySort]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const rejected = rows.filter(r => r.status === 'rejected').length;
    const coinsUsed = rows.reduce((acc, r) => acc + Number(r.coins_required || 0), 0);
    return { total, pending, approved, rejected, coinsUsed };
  }, [rows]);

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', icon: CheckCircle2, rowAccent: 'border-l-2 border-emerald-400/60' };
    if (s === 'pending') return { label: 'Pending', className: 'bg-amber-500/15 text-amber-200 border-amber-300/30', icon: Clock, rowAccent: 'border-l-2 border-amber-400/60' };
    if (s === 'rejected') return { label: 'Rejected', className: 'bg-rose-500/15 text-rose-200 border-rose-300/30', icon: XCircle, rowAccent: 'border-l-2 border-rose-400/60' };
    return { label: 'Unknown', className: 'bg-slate-500/15 text-slate-200 border-slate-300/30', icon: Clock, rowAccent: 'border-l-2 border-slate-400/50' };
  };

  // Note: Redemption action will use admin-configured rewards; no hardcoded catalog here.
  const onRedeemClick = (rw) => {
    setSelectedReward(rw);
    setRedeemStep('confirm');
    setRedeemOpen(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward || !user) return;
    if (!hasSupabaseConfig || !supabase) {
      toast({ title: 'Configuration missing', description: 'Supabase env vars are not set. Please configure .env.local', variant: 'destructive' });
      return;
    }
  const price = Number(selectedReward.coins_required ?? selectedReward.coin_cost ?? selectedReward.coins ?? 0);
    if ((userProfile?.wallet_balance ?? 0) < price) {
      toast({ title: 'Not enough coins', description: 'Earn more coins to redeem this reward.' });
      return;
    }
    try {
      setRedeemSubmitting(true);
      const { error } = await supabase.rpc('redeem_from_catalog', {
        p_catalog_id: selectedReward.id,
      });
      if (error) throw error;
      setRedeemStep('success');
      toast({
        title: 'Reward granted',
        description: 'Congratulations! Your reward has been issued instantly.',
      });
      // refresh history
      await loadRedemptions();
      // refresh wallet balance immediately (ignore errors)
      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile(user).catch(() => { void 0; });
      }
    } catch (e) {
      const message = e?.message || 'Please try again later';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    } finally {
      setRedeemSubmitting(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6">
      {/* background mesh */}
      <div className="absolute inset-0 -z-10 opacity-70 mix-blend-screen [background-image:radial-gradient(circle_at_18%_28%,rgba(56,189,248,0.25),rgba(0,0,0,0)60%),radial-gradient(circle_at_82%_72%,rgba(192,132,252,0.22),rgba(0,0,0,0)65%),radial-gradient(circle_at_50%_50%,rgba(244,114,182,0.15),rgba(0,0,0,0)55%)]" />
      {/* removed floating decorative icons for a cleaner layout */}

      {/* header */}
      <div className="mb-6">
  <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-3"
        >
          <m.div
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center ring-2 ring-white/30 shadow-xl"
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <Receipt className="w-5 h-5 text-white" />
          </m.div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent tracking-tight">
              Redemptions
            </h1>
            <div className="mt-0.5 h-[2px] w-24 bg-gradient-to-r from-indigo-400/60 via-fuchsia-400/60 to-pink-400/60 rounded-full" />
            <p className="text-slate-300/80 text-sm mt-1">Track your reward requests</p>
          </div>
          {/* removed top-right wallet coins badge as requested */}
  </m.div>
      </div>

      {/* Dev guard: if Supabase is not configured, show a helpful message */}
      {!hasSupabaseConfig && (
        <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-amber-100 text-sm">
          Supabase configuration missing. Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable redemptions and history.
        </div>
      )}

      {/* Top tabs: Rewards | History */}
      <div className="mb-4 flex items-center gap-2">
        {[
          { key: 'rewards', label: 'Rewards' },
          { key: 'history', label: 'History' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              activeTab === tab.key
                ? 'bg-white/10 text-white border-white/20 shadow hover:bg-white/15'
                : 'bg-white/5 text-slate-200/90 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto" />
      </div>

      {/* Rewards Section */}
      {activeTab === 'rewards' && (
  <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="relative rounded-3xl p-[1px] bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(1200px_600px_at_90%_110%,rgba(217,70,239,0.22),transparent_60%)] mb-6"
        >
          <div className="qd-card rounded-3xl p-5 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-500/25 border border-white/10 items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-fuchsia-200" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-100">Available Rewards</h2>
          </div>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={rewardQuery}
                onChange={(e) => setRewardQuery(e.target.value)}
                placeholder="Search rewards..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'new', label: 'New' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setRewardFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    rewardFilter === f.key
                      ? 'bg-white/10 text-white border-white/20 shadow hover:bg-white/15'
                      : 'bg-white/5 text-slate-200/90 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {rewardsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-violet-500/30">
                <div className="rounded-2xl p-3 bg-slate-900/50 border border-white/10">
                  <div className="animate-pulse space-y-3">
                    <div className="h-24 rounded-xl bg-slate-700/40" />
                    <div className="h-3 rounded bg-slate-700/40 w-3/4" />
                    <div className="h-2.5 rounded bg-slate-700/40 w-1/2" />
                    <div className="h-8 rounded-lg bg-slate-700/40 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (filteredRewards?.length || 0) === 0 ? (
          <div className="text-center py-8 text-slate-300">No rewards found. Try a different search or filter.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredRewards.map((rw) => {
              const price = Number(rw.coins_required || rw.coins || 0);
              const affordable = walletCoins >= price;
              const createdAt = rw.created_at ? new Date(rw.created_at).getTime() : 0;
              const isNew = createdAt && Date.now() - createdAt <= 1000 * 60 * 60 * 24 * 14;
              return (
                <m.div key={rw.id} className="group rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-violet-500/30 shadow-lg relative overflow-hidden" whileHover={{ y: -2, scale: 1.005 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  {/* subtle conic shine on hover */}
                  <m.div
                    className="pointer-events-none absolute -inset-20 opacity-0 group-hover:opacity-40 bg-[conic-gradient(from_200deg_at_50%_50%,rgba(99,102,241,0.15),rgba(217,70,239,0.12),rgba(236,72,153,0.1),transparent_60%)]"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
                  />
                  <div className="relative rounded-2xl p-3 bg-slate-900/60 border border-white/10 transition duration-200 group-hover:border-indigo-400/50 group-hover:bg-slate-900/50">
                    <div className="relative rounded-xl bg-white/5 border border-white/10 h-28 overflow-hidden">
                      {rw.image_url ? (
                        <img
                          src={rw.image_url}
                          alt={rw.title || 'Reward'}
                          className="h-full w-full object-cover"
                          onError={(e)=>{ e.currentTarget.style.display='none'; }}
                        />
                      ) : (
                        <div className="h-full w-full grid place-items-center">
                          <Gift className="w-7 h-7 text-white/80" />
                        </div>
                      )}
                      {/* coin price badge */}
                      <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 bg-black/55 backdrop-blur border border-white/10 text-[11px] font-semibold text-indigo-100 shadow">
                        <Coins className="w-3.5 h-3.5" /> {price.toLocaleString()}
                      </div>
                      {isNew && (
                        <div className="absolute left-0 top-2 rounded-r-full px-2 py-0.5 bg-fuchsia-500/80 text-[10px] font-bold text-white tracking-wide shadow">NEW</div>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-slate-100 truncate">{rw.title || rw.reward_type}</div>
                      {rw.description ? (
                        <div className="text-[12px] text-slate-300/80 line-clamp-2 min-h-[28px]">{rw.description}</div>
                      ) : (
                        <div className="h-[28px]" />
                      )}
                      <button
                        type="button"
                        disabled={!affordable}
                        className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold border transition focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${
                          affordable
                            ? 'bg-gradient-to-r from-indigo-600/85 to-fuchsia-600/85 text-white border-white/10 hover:from-indigo-600 hover:to-fuchsia-600 shadow-md hover:shadow-lg active:scale-[0.99]'
                            : 'bg-white/5 text-slate-300/70 border-white/10 cursor-not-allowed'
                        }`}
                        onClick={() => onRedeemClick(rw)}
                        title={affordable ? 'Redeem reward' : 'Not enough coins'}
                      >
                        Redeem <ArrowRight className="w-4 h-4" />
                      </button>
                      {!affordable && (
                        <div className="mt-1 text-[10px] text-slate-400/80">
                          Not enough coins. <Link to="/refer" className="text-indigo-300 hover:underline">Earn more</Link>
                        </div>
                      )}
                    </div>
                  </div>
                </m.div>
              );
            })}
          </div>
        )}
          </div>
  </m.div>
      )}

      {/* stats card - show only in Rewards tab */}
      {activeTab === 'rewards' && (
        <div className="rounded-3xl p-5 md:p-6 bg-white/[0.035] backdrop-blur-xl border border-white/10 shadow-2xl mb-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -inset-px opacity-[0.06] bg-[radial-gradient(600px_200px_at_10%_-20%,#6366f1,transparent),radial-gradient(500px_200px_at_90%_120%,#e879f9,transparent)]" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl p-3.5 bg-indigo-500/10 border border-indigo-300/25">
              <div className="text-[11px] font-semibold text-indigo-200/90">Total Requests</div>
              <div className="mt-1 text-xl font-extrabold text-indigo-200">{stats.total}</div>
            </div>
            <div className="rounded-2xl p-3.5 bg-amber-500/10 border border-amber-300/25">
              <div className="text-[11px] font-semibold text-amber-200/90">Pending</div>
              <div className="mt-1 text-xl font-extrabold text-amber-200">{stats.pending}</div>
            </div>
            <div className="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-300/25">
              <div className="text-[11px] font-semibold text-emerald-200/90">Approved</div>
              <div className="mt-1 text-xl font-extrabold text-emerald-200">{stats.approved}</div>
            </div>
            <div className="rounded-2xl p-3.5 bg-fuchsia-500/10 border border-fuchsia-300/25">
              <div className="text-[11px] font-semibold text-fuchsia-200/90 inline-flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Coins Used</div>
              <div className="mt-1 text-xl font-extrabold text-fuchsia-200">{Number(stats.coinsUsed || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Redemptions history list */}
      {activeTab === 'history' && (
      <div className="qd-card rounded-3xl p-5 shadow-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-indigo-900/30 border border-indigo-700/40">
                <div className="animate-pulse flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 w-2/3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-800/40" />
                    <div className="flex-1">
                      <div className="h-3 bg-indigo-800/40 rounded w-2/3 mb-2" />
                      <div className="h-2.5 bg-indigo-800/40 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-3 w-20 bg-indigo-800/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md mb-3">
              <Gift className="w-6 h-6" />
            </div>
            <p className="text-slate-200 font-semibold">No redemptions yet</p>
            <p className="text-slate-400 text-sm">Make a request and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((r) => {
              const badge = statusBadge(r.status);
              const BadgeIcon = badge.icon;
              return (
                <m.div key={r.id} className={`p-3 rounded-xl bg-indigo-900/30 border border-indigo-700/40 hover:border-indigo-400/50 transition hover:shadow-lg ${badge.rowAccent}`} whileHover={{ y: -2 }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-violet-500 to-fuchsia-500 ring-2 ring-white/20">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate">
                          {r.reward_type}: {r.reward_value}
                        </p>
                        <p className="text-[11px] text-slate-400/80 font-mono truncate">
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-indigo-200 whitespace-nowrap">
                        {Number(r.coins_required || 0).toLocaleString()} <span className="text-[10px] uppercase text-slate-400/80">coins</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badge.className} shadow`}> 
                        <BadgeIcon className="w-3.5 h-3.5" /> {badge.label}
                      </span>
                      <button
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-200 hover:bg-white/10"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(String(r.id));
                            toast({ title: 'Copied', description: 'Redemption ID copied' });
                          } catch {
                            toast({ title: 'Copy failed', description: 'Unable to copy ID', variant: 'destructive' });
                          }
                        }}
                        title="Copy redemption ID"
                      >
                        <Copy className="w-3.5 h-3.5" /> ID
                      </button>
                    </div>
                  </div>
                </m.div>
              );
            })}
          </div>
        )}
      </div>
      )}

  {/* Redeem Preview Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="bg-slate-900/95 border-white/10 text-slate-100 sm:rounded-2xl p-0 overflow-hidden">
          {selectedReward && (
            <div className="relative">
              <div className="relative h-28 bg-gradient-to-r from-indigo-600/30 via-fuchsia-600/20 to-pink-600/30">
                <div className="absolute inset-0 bg-[radial-gradient(800px_200px_at_10%_-50%,rgba(99,102,241,0.35),transparent),radial-gradient(700px_200px_at_90%_130%,rgba(217,70,239,0.35),transparent)]" />
              </div>
              <div className="p-5">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <PartyPopper className="w-5 h-5 text-fuchsia-300" /> Redeem Reward
                  </DialogTitle>
                  <DialogDescription className="text-slate-300">
                    Review the details below and confirm your redemption.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="h-28 bg-black/30 grid place-items-center">
                        {selectedReward.image_url ? (
                          <img src={selectedReward.image_url} alt={selectedReward.title || 'Reward'} className="h-full w-full object-cover" onError={(e)=>{ e.currentTarget.style.display='none'; }} loading="lazy" decoding="async" />
                        ) : (
                          <Gift className="w-7 h-7 text-white/80" />
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-semibold truncate">{selectedReward.title || selectedReward.reward_type}</div>
                        {selectedReward.description && (
                          <div className="text-xs text-slate-300/80 line-clamp-2 mt-0.5">{selectedReward.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 grid gap-3 content-start">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <span className="text-sm text-slate-300">Price</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-200"><Coins className="w-4 h-4" /> {Number(selectedReward.coins_required || selectedReward.coins || 0).toLocaleString()} coins</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <span className="text-sm text-slate-300">Your balance</span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-200"><WalletIcon className="w-4 h-4" /> {walletCoins.toLocaleString()} coins</span>
                    </div>
                    <div className="text-xs text-slate-400">Note: Redemption is instant. Your coins will be deducted immediately and the reward will be issued.</div>
                  </div>
                </div>

                <DialogFooter className="mt-5">
                  {redeemStep === 'confirm' ? (
                    <div className="w-full flex gap-2 sm:justify-end">
                      <Button variant="soft" onClick={() => setRedeemOpen(false)} className="border border-white/10">Cancel</Button>
                      <Button onClick={handleConfirmRedeem} disabled={redeemSubmitting || walletCoins < Number(selectedReward.coins_required || selectedReward.coins || 0)} className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-600">
                        {redeemSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Processing</>) : (<>Confirm & Redeem</>)}
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300 mt-0.5" />
                        <div>
                          <div className="font-semibold">Redeemed successfully</div>
                          <div className="text-xs opacity-80">Your reward has been granted immediately.</div>
                        </div>
                      </div>
                      {/* Confetti micro-animation */}
                      <AnimatePresence>
                        <m.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="relative h-0"
                        >
                          {[...Array(10)].map((_, i) => (
                            <m.span
                              key={i}
                              className="absolute inline-block w-2 h-2 rounded-sm"
                              style={{
                                left: `${10 + i * 8}%`,
                                top: -8,
                                background: ['#a78bfa','#f472b6','#60a5fa','#34d399','#f59e0b'][i % 5],
                              }}
                              initial={{ y: -10, rotate: 0, opacity: 0 }}
                              animate={{ y: 40 + Math.random() * 20, rotate: 120 + Math.random() * 180, opacity: 1 }}
                              transition={{ duration: 0.9, delay: i * 0.04, ease: 'ease-out' }}
                            />
                          ))}
                        </m.div>
                      </AnimatePresence>
                      <div className="mt-4 flex justify-end">
                        <Button onClick={() => setRedeemOpen(false)} variant="brand">Close</Button>
                      </div>
                    </div>
                  )}
                </DialogFooter>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
