import React, { useEffect, useState } from 'react';
import { Gift, Users, Coins, Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const ReferEarn = () => {
  const { user, userProfile } = useAuth();
  const [referralStats, setReferralStats] = useState({ total: 0, earnings: 0 });
  const [referralHistory, setReferralHistory] = useState([]);
  const [copied, setCopied] = useState(''); // 'code' | 'link' | ''
  const [loading, setLoading] = useState(true);

  const referralCode = userProfile?.referral_code || '';
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data: referrals, error } = await supabase
          .from('referrals')
          .select(`
            *,
            referred:profiles!referrals_referred_id_fkey(
              username, full_name, avatar_url
            )
          `)
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });
        if (error && error.code !== 'PGRST116') throw error;
        if (!mounted) return;
        const total = referrals?.length || 0;
        const earnings = referrals?.reduce((sum, r) => sum + (r.coins_awarded || 0), 0) || 0;
        setReferralStats({ total, earnings });
        setReferralHistory(referrals || []);
      } catch (e) {
        if (!mounted) return;
        setReferralStats({ total: 0, earnings: 0 });
        setReferralHistory([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const copyToClipboard = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(kind); setTimeout(() => setCopied(''), 1600);
    }
  };

  const shareReferralLink = async () => {
    const shareData = {
      title: 'Join Quiz Dangal',
      text: 'Earn coins by playing quizzes! Use my referral to get started.',
      url: referralLink,
    };

    // Prefer Web Share API v2
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // If user cancels, just return; otherwise try fallbacks
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
      }
    }

    // Mobile-friendly fallbacks: WhatsApp, Telegram, then copy
    try {
      const encoded = encodeURIComponent(`${shareData.text}\n${shareData.url}`);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      // Try WhatsApp
      const wa = isIOS ? `https://wa.me/?text=${encoded}` : `whatsapp://send?text=${encoded}`;
      const openedWa = window.open(wa, '_blank');
      if (openedWa) return;

      // Try Telegram
      const tg = `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`;
      const openedTg = window.open(tg, '_blank');
      if (openedTg) return;
    } catch {}

    // Last resort: copy
    copyToClipboard(referralLink, 'link');
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-2xl text-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-6 h-6 text-emerald-300" />
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">Refer & Earn</h1>
        </div>

        {/* Reward banner */}
        <div className="rounded-2xl p-4 mb-6 bg-emerald-900/25 border border-emerald-600/30 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden hd-badge-coin relative shrink-0" aria-hidden>
              <div className="hd-badge-coin-front">
                <Coins className="hd-badge-coin-icon" />
                <span className="hd-badge-coin-shine" />
              </div>
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-wide"><span className="text-amber-200">Earn +50 coins</span> per referral</div>
              <div className="text-sm text-emerald-100/90">Coins are added after your friend signs up and completes their profile.</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl p-4 text-center bg-gradient-to-br from-sky-900/40 via-cyan-900/30 to-emerald-900/20 border border-cyan-600/40">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-cyan-300" />
              <span className="text-2xl font-extrabold bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">{referralStats.total}</span>
            </div>
            <p className="text-xs sm:text-sm text-cyan-200/90 tracking-wide">Friends Referred</p>
          </div>
          <div className="rounded-xl p-4 text-center bg-gradient-to-br from-amber-900/30 via-yellow-900/20 to-transparent border border-amber-600/40">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="relative inline-flex w-6 h-6 align-middle rounded-full overflow-hidden hd-badge-coin shrink-0">
                <span className="hd-badge-coin-front"><Coins className="hd-badge-coin-icon" /><span className="hd-badge-coin-shine" /></span>
              </span>
              <span className="text-2xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 bg-clip-text text-transparent">{referralStats.earnings}</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-200/90 tracking-wide">Coins Earned</p>
          </div>
        </div>

        {/* Code */}
        <div className="space-y-2 mb-5">
          <h3 className="font-semibold text-slate-200">Your Referral Code</h3>
          <div className="flex items-center gap-2">
            <Input value={referralCode} readOnly className="font-mono text-center text-lg font-bold bg-slate-900/60 border-slate-700/60 text-slate-100" />
            <Button onClick={() => copyToClipboard(referralCode, 'code')} variant="outline" size="sm" className="px-3 border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/30">
              {copied === 'code' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-cyan-300" />}
            </Button>
          </div>
        </div>

        {/* Link */}
        <div className="space-y-2 mb-6">
          <h3 className="font-semibold text-slate-200">Your Referral Link</h3>
          <div className="flex items-center gap-2">
            <Input value={referralLink} readOnly className="text-sm bg-slate-900/60 border-slate-700/60 text-slate-100" />
            <Button onClick={() => copyToClipboard(referralLink, 'link')} variant="outline" size="sm" className="px-3 border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/30">
              {copied === 'link' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-cyan-300" />}
            </Button>
          </div>
        </div>

        {/* Share + Copy */}
        <div className="flex gap-2">
          <Button onClick={shareReferralLink} className="flex-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-90 border border-indigo-400/40">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button onClick={() => copyToClipboard(referralLink, 'link')} variant="outline" className="flex-1 border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/30">
            {copied === 'link' ? <Check className="w-4 h-4 mr-2 text-emerald-300" /> : <Copy className="w-4 h-4 mr-2 text-cyan-300" />} {copied === 'link' ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        {/* History */}
        {!loading && (
          referralHistory.length > 0 ? (
            <div className="space-y-3 mt-6">
              <h3 className="font-semibold text-slate-200">Recent Referrals</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {referralHistory.slice(0, 8).map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                    <div>
                      <div className="font-medium text-slate-100">{ref.referred?.username || 'New User'}</div>
                      <div className="text-xs text-slate-400">{new Date(ref.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-300">
                      <span className="relative inline-flex w-5 h-5 align-middle rounded-full overflow-hidden hd-badge-coin shrink-0">
                        <span className="hd-badge-coin-front"><Coins className="hd-badge-coin-icon" /><span className="hd-badge-coin-shine" /></span>
                      </span>
                      <span className="font-bold">+{ref.coins_awarded}</span>
                    </div>
                  </div>
                ))}
              </div>
              {referralHistory.length > 8 && (
                <p className="text-xs text-slate-400">And {referralHistory.length - 8} more referrals…</p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 mt-6">
              <Users className="w-12 h-12 mx-auto mb-2 text-slate-500" />
              <p className="text-slate-200">No referrals yet</p>
              <p className="text-sm">Start sharing your link to earn coins!</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ReferEarn;
