import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, m } from '@/lib/motion-lite';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Receipt, Gift, CheckCircle2, Clock, XCircle, Coins, Sparkles, PartyPopper, ArrowRight, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SEO from '@/components/SEO';
// Removed Link import since we no longer show the Earn now link

export default function Redemptions() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  // search is removed from UI; keep list as-is
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemStep, setRedeemStep] = useState('confirm'); // confirm | success
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);
  const [payoutIdentifier, setPayoutIdentifier] = useState('');
  const [payoutChannel, setPayoutChannel] = useState('upi');
  const [redeemMode, setRedeemMode] = useState('cash'); // cash | voucher
  const payoutInputRef = React.useRef(null);
  // Mobile keyboard handling: when input focused on small screens, lift dialog upward for better visibility
  const [inputFocused, setInputFocused] = useState(false);
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const [activeTab, setActiveTab] = useState('rewards'); // rewards | history
  const historyQuery = '';
  const historySort = 'newest';
  
  // Use backend reward_value exactly as provided (no extra suffix/prefix)
  const getRawRewardValue = useCallback((rw) => {
    if (!rw) return '';
    const v = rw.reward_value ?? rw.value ?? rw.amount ?? '';
    return (v === null || v === undefined) ? '' : String(v).trim();
  }, []);

  // Display reward value exactly as provided by admin/backend without forcing currency like 'Rs.'
  const formatRewardValue = useCallback((value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }, []);

  const loadRedemptions = useCallback(async () => {
    if (!user || !hasSupabaseConfig || !supabase) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('redemptions')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch redemptions history', error);
        setRows([]);
        return;
      }
      setRows(data || []);
    } catch (err) {
      console.error('Unexpected error while fetching redemptions history', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasSupabaseConfig || !supabase) {
      setRows([]);
      setLoading(false);
      return;
    }
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

  const filteredRewards = rewards || [];

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

  const resolveRewardMode = useCallback((rw) => {
    const raw = String(rw?.reward_type || '').trim().toLowerCase();
    if (!raw) return 'cash';
    if (raw.includes('cash')) return 'cash';
    if (raw.includes('voucher')) return 'voucher';
    return raw === 'voucher' ? 'voucher' : 'cash';
  }, []);

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
    const mode = resolveRewardMode(rw);
    setSelectedReward(rw);
    setRedeemMode(mode);
    setRedeemStep('confirm');
    setPayoutIdentifier('');
    setInputFocused(false);
    setPayoutChannel(mode === 'voucher' ? 'phone' : 'upi');
    setRedeemOpen(true);
    setTimeout(() => {
      try { payoutInputRef.current?.focus(); } catch (e) { /* ignore focus error */ }
    }, 100);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward || !user) return;
    if (!hasSupabaseConfig || !supabase) {
      toast({ title: 'Configuration missing', description: 'Supabase env vars are not set. Please configure .env.local', variant: 'destructive' });
      return;
    }
    const requiresWhatsApp = redeemMode === 'voucher';
    const price = Number(selectedReward.coins_required ?? selectedReward.coin_cost ?? selectedReward.coins ?? 0);
    const rawIdentifier = payoutIdentifier.trim();
    if ((userProfile?.wallet_balance ?? 0) < price) {
      toast({ title: 'Not enough coins', description: 'Earn more coins to redeem this reward.' });
      return;
    }
    if (!rawIdentifier) {
      toast({ title: 'Enter payout details', description: requiresWhatsApp ? 'Please provide your WhatsApp number.' : 'Please provide your UPI ID or phone number.' });
      return;
    }
    let identifierToSend = rawIdentifier;
    if (requiresWhatsApp) {
      const digitsOnly = rawIdentifier.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        toast({ title: 'Invalid WhatsApp number', description: 'Please enter a valid WhatsApp number with 8 to 15 digits.', variant: 'destructive' });
        return;
      }
      identifierToSend = digitsOnly;
    }
    try {
      setRedeemSubmitting(true);
      const channel = requiresWhatsApp ? 'phone' : (payoutChannel || 'upi');
      if (requiresWhatsApp && payoutChannel !== 'phone') setPayoutChannel('phone');
      const rpcPayload = {
        p_catalog_id: selectedReward.id,
        p_payout_identifier: identifierToSend,
        p_payout_channel: channel
      };
      let { error } = await supabase.rpc('redeem_from_catalog_with_details', rpcPayload);
      if (error) throw error;
      setRedeemStep('success');
      toast({ title: 'Redemption pending', description: 'Your request is submitted. Await admin approval.' });
      setPayoutIdentifier('');
      await loadRedemptions();
      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile(user).catch(() => { void 0; });
      }
    } catch (e) {
      const message = e?.message || 'Please try again later';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
    } finally {
      setRedeemSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="Redemptions – Quiz Dangal"
        description="View and manage your reward redemptions on Quiz Dangal."
  canonical="https://quizdangal.com/redemptions/"
        robots="noindex, nofollow"
      />
  <div className="relative pt-20 mx-auto max-w-5xl px-4 py-6">
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
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-500/25 border border-white/10 items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-fuchsia-200" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-slate-100">Available Rewards</h2>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredRewards.map((rw) => {
              const price = Number(rw.coins_required ?? rw.coin_cost ?? rw.coins ?? 0);
              const rewardValue = getRawRewardValue(rw);
              const displayValue = formatRewardValue(rewardValue);
              const affordable = walletCoins >= price;
              const pct = price > 0 ? Math.min(100, Math.max(0, Math.round((walletCoins / price) * 100))) : 100;
              // helper text removed: no need to compute remainingCoins here
              const description = rw.description ? String(rw.description).trim() : '';
              return (
                <m.div
                  key={rw.id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(31,41,80,0.92),rgba(11,15,34,0.96))] shadow-[0_25px_45px_-35px_rgba(129,140,248,0.9)] backdrop-blur-xl"
                  whileHover={{ y: -4, scale: 1.015 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                >
                    <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[4/4.5]">
                    {rw.image_url ? (
                      <img
                        src={rw.image_url}
                        alt={rw.title || 'Reward preview'}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-indigo-500/40 via-fuchsia-500/30 to-sky-500/25">
                        <div className="grid place-items-center rounded-2xl bg-black/30 p-6 pt-7 shadow-lg ring-1 ring-white/12">
                          <Gift className="h-11 w-11 text-white/95 translate-y-1" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                    <div className="relative flex h-full flex-col items-center justify-end gap-2 p-4 pb-12 text-center">
                      {/* Value chip - fixed absolute position for consistency across screens */}
                      {displayValue && (
                        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3">
                          <div
                            className="inline-flex w-[94%] sm:w-[90%] items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-r from-white/15 to-white/10 px-5 py-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md ring-1 ring-white/10"
                            title={displayValue}
                          >
                            <span className="text-[clamp(0.9rem,2.5vw,1.125rem)] font-semibold tracking-tight leading-none whitespace-nowrap">
                              {displayValue}
                            </span>
                          </div>
                        </div>
                      )}
                      {rw.title && (
                        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-100/80 sm:text-sm sm:normal-case sm:tracking-normal sm:text-slate-100/90">
                          {rw.title}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {description && (
                      <p className="text-xs leading-relaxed text-slate-300/85">
                        {description.length > 140 ? `${description.slice(0, 137)}...` : description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.42),rgba(12,15,35,0.92))] px-3.5 py-3 shadow-[0_18px_34px_-26px_rgba(129,140,248,0.75)] backdrop-blur">
                      <div className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/12 text-indigo-100 ring-1 ring-white/35 shadow-inner">
                        <Coins className="h-3.5 w-3.5" />
                      </div>
                      <div className="leading-tight text-left text-white">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-white/70">Coins needed</div>
                        <div className="text-base font-semibold tracking-tight text-white">
                          {price.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a855f7,#f472b6)] shadow-[0_0_12px_rgba(168,85,247,0.45)] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => onRedeemClick(rw)}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${
                          affordable
                            ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg hover:from-indigo-500 hover:to-fuchsia-500'
                            : 'bg-white/5 text-slate-300/70 border border-white/10 cursor-not-allowed'
                        }`}
                        title={affordable ? 'Redeem reward' : 'Not enough coins yet'}
                      >
                        Redeem <ArrowRight className="h-4 w-4" />
                      </button>
                      {/* Helper text under redeem removed as requested (leave empty area) */}
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
                <m.div key={r.id} className={`p-3 sm:p-3.5 rounded-xl bg-indigo-900/30 border border-indigo-700/40 hover:border-indigo-400/50 transition hover:shadow-lg ${badge.rowAccent}`} whileHover={{ y: -2 }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-violet-500 to-fuchsia-500 ring-2 ring-white/20 flex-shrink-0">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        {/* reward value only - without star icon, allow full text */}
                        <div className="inline-block rounded-lg px-2.5 py-1 bg-white/5 border border-white/10 backdrop-blur-sm shadow-sm max-w-full">
                          <span className="text-slate-100 font-semibold text-sm leading-snug break-words">
                            {r.reward_value}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400/80 font-mono truncate">
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
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
      <Dialog open={redeemOpen} onOpenChange={(o)=> {
        if (!o) {
          setInputFocused(false);
          setSelectedReward(null);
          setPayoutIdentifier('');
          setPayoutChannel('upi');
          setRedeemStep('confirm');
          setRedeemSubmitting(false);
          setRedeemMode('cash');
        }
        setRedeemOpen(o);
      }}>
        <DialogContent className={`bg-slate-900/95 border-white/10 text-slate-100 rounded-xl sm:rounded-2xl p-0 overflow-hidden w-[min(94vw,600px)] sm:max-w-xl md:max-w-2xl max-h-[86svh] transition-transform duration-300 ${isMobile && inputFocused ? 'translate-y-[-12svh]' : ''}`}>        
          {selectedReward && (() => {
            const isVoucherReward = redeemMode === 'voucher';
            const payoutLabel = isVoucherReward ? 'WhatsApp Number' : (payoutChannel === 'phone' ? 'Phone Number' : 'UPI ID');
            const payoutPlaceholder = isVoucherReward ? 'Enter WhatsApp number (8-15 digits)' : (payoutChannel === 'phone' ? 'Enter phone number' : 'Enter UPI ID');
            const payoutInputMode = (isVoucherReward || payoutChannel === 'phone') ? 'tel' : 'text';
            return (
            <div className="p-4 sm:p-6 md:p-7">
              <DialogHeader className="flex flex-col items-center text-center">
                <DialogTitle className="text-xl sm:text-2xl font-extrabold flex items-center justify-center gap-2">
                  <PartyPopper className="w-6 h-6 text-fuchsia-300" /> Redeem
                </DialogTitle>
                <div className="w-full flex justify-center">
                  <DialogDescription className="text-slate-300 text-sm sm:text-base mt-1 max-w-[520px]">
                    {redeemStep==='confirm' ? 'Enter payout details to submit your request.' : 'Submitted. Pending admin approval.'}
                  </DialogDescription>
                </div>
              </DialogHeader>

              {/* Top summary intentionally removed (was value/coins line). No empty block retained. */}

              <DialogFooter className="mt-6">
                {redeemStep === 'confirm' ? (
                  <div className="w-full">
                    <div className="space-y-4 mb-5">
                      {isVoucherReward ? (
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">{payoutLabel}</label>
                            <input
                              ref={payoutInputRef}
                              value={payoutIdentifier}
                              onChange={(e)=> setPayoutIdentifier(e.target.value)}
                              onFocus={()=> setInputFocused(true)}
                              onBlur={()=> setInputFocused(false)}
                              placeholder={payoutPlaceholder}
                              inputMode={payoutInputMode}
                              className="w-full px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-600 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <p className="mt-2 text-[11px] text-slate-400">Voucher code WhatsApp par share kiya jayega.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Payout Method</label>
                            <div className="flex gap-2">
                              {['upi','phone'].map(ch => (
                                <button key={ch} type="button" onClick={()=> setPayoutChannel(ch)} className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${payoutChannel===ch? 'bg-indigo-600 text-white border-indigo-600':'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}>{ch.toUpperCase()}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-[2]">
                            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">{payoutLabel}</label>
                            <input
                              ref={payoutInputRef}
                              value={payoutIdentifier}
                              onChange={(e)=> setPayoutIdentifier(e.target.value)}
                              onFocus={()=> setInputFocused(true)}
                              onBlur={()=> setInputFocused(false)}
                              placeholder={payoutPlaceholder}
                              inputMode={payoutInputMode}
                              className="w-full px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-600 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                          </div>
                        </div>
                      )}
                      {(() => { const price = Number(selectedReward.coins_required ?? selectedReward.coin_cost ?? selectedReward.coins ?? 0); return (
                        <div className="text-xs text-slate-400 text-center">
                          <span className="text-white font-semibold">{getRawRewardValue(selectedReward)}</span> • <span className="text-fuchsia-200 font-semibold">{price.toLocaleString()} coins</span>
                        </div>
                      ); })()}
                    </div>
                    {(() => { const rewardLabel = getRawRewardValue(selectedReward); const price = Number(selectedReward.coins_required ?? selectedReward.coin_cost ?? selectedReward.coins ?? 0); return (
                      <Button onClick={handleConfirmRedeem} disabled={redeemSubmitting || walletCoins < price} className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-600 text-base py-3 h-12">
                        {redeemSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Submitting</>) : (<>Redeem {rewardLabel}</>)}
                      </Button>
                    ); })()}
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-300 mt-0.5" />
                      <div>
                        <div className="font-semibold">Redemption submitted</div>
                        <div className="text-xs opacity-80">Your request is pending admin approval. You will receive payout after review.</div>
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
                            transition={{ duration: 0.9, delay: i * 0.04, ease: 'easeOut' }}
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
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
