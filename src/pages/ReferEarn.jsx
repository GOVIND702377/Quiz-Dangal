import React, { useEffect, useState } from 'react';
import { Gift, Users, Coins, Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getSignedAvatarUrls } from '@/lib/avatar';

const ReferEarn = () => {
  const { user, userProfile } = useAuth();
  const [referralStats, setReferralStats] = useState({ total: 0, earnings: 0 });
  const [referralHistory, setReferralHistory] = useState([]);
  const [copied, setCopied] = useState(''); // 'code' | 'link' | ''
  const [loading, setLoading] = useState(true);
  const [posterBlob, setPosterBlob] = useState(null);

  const referralCode = userProfile?.referral_code || '';
  const referralLink = `${window.location.origin}?ref=${referralCode}`;
  const shareCaption = 'Earn coins by playing quizzes! Use my referral to get started.';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data: referrals, error } = await supabase
          .from('referrals')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });
        if (error && error.code !== 'PGRST116') throw error;
        if (!mounted) return;

        let history = referrals || [];
        if (history.length) {
          const referredIds = Array.from(new Set(history.map(r => r.referred_id).filter(Boolean)));
          if (referredIds.length) {
            const { data: publicProfiles, error: profileError } = await supabase
              .rpc('profiles_public_by_ids', { p_ids: referredIds });
            if (profileError) {
              console.warn('Referral profile lookup failed:', profileError);
            }
            const profiles = publicProfiles || [];
            const profileMap = new Map(profiles.map(p => [p.id, p]));
            const signedMap = await getSignedAvatarUrls(profiles.map(p => p.avatar_url).filter(Boolean));
            history = history.map(ref => {
              const publicProfile = profileMap.get(ref.referred_id);
              if (!publicProfile) return { ...ref, referred: null };
              const signedUrl = publicProfile.avatar_url ? signedMap.get(publicProfile.avatar_url) || '' : '';
              return {
                ...ref,
                referred: {
                  ...publicProfile,
                  avatar_url: signedUrl,
                },
              };
            });
          }
        }

        const total = history.length;
        const earnings = history.reduce((sum, r) => sum + (r.coins_awarded || 0), 0) || 0;
        setReferralStats({ total, earnings });
        setReferralHistory(history);
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

  // Prepare static poster in background for faster share
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always use the fixed poster from /public
        const posterUrl = `${window.location.origin}/refer-earn-poster.png`;
        const res = await fetch(posterUrl, { cache: 'force-cache' });
        const blob = await res.blob();
        if (!cancelled) setPosterBlob(blob);
      } catch {
        if (!cancelled) setPosterBlob(null);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCode]);

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

  // Removed dynamic canvas poster. We always use the static image in /public now.

  const shareReferralLink = async () => {
    // Original caption text to go below the static poster
    const textPayload = `${shareCaption} ${referralLink}`;

    // Try Web Share API v2 with the static poster file
    try {
      const blob = posterBlob;
      if (blob && navigator.canShare && window.File) {
        const file = new File([blob], 'refer-earn-poster.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file], text: textPayload })) {
          await navigator.share({ files: [file], text: textPayload });
          return;
        }
      }
    } catch {}

    // Fallbacks: open WhatsApp/Telegram with text-only; user can attach poster manually if needed
    try {
      const encoded = encodeURIComponent(`${shareCaption}\n${referralLink}`);
      const ua = navigator.userAgent || '';
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const wa = isIOS ? `https://wa.me/?text=${encoded}` : `whatsapp://send?text=${encoded}`;
      const openedWa = window.open(wa, '_blank'); if (openedWa) return;
      const tg = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareCaption)}`;
      const openedTg = window.open(tg, '_blank'); if (openedTg) return;
    } catch {}
    copyToClipboard(referralLink, 'link');
  };

  const downloadPoster = async () => {
    try {
      const blob = posterBlob;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'refer-earn-poster.png'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {}
  };

  // Dedicated WhatsApp button (deep link + fallback) for Refer & Earn
  const shareToWhatsApp = async () => {
    try {
      const encoded = encodeURIComponent(`${shareCaption} ${referralLink}`);
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);

      const waDeep = `whatsapp://send?text=${encoded}`;
      const intentUrl = `intent://send?text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      const waWeb = `https://wa.me/?text=${encoded}`;

      const openNew = (url) => {
        const w = window.open(url, '_blank');
        return !!w;
      };

      if (isAndroid) {
        if (openNew(waDeep)) return;
        window.location.href = intentUrl;
        setTimeout(() => { if (!document.hidden) window.location.href = waWeb; }, 700);
        return;
      }

      if (isIOS) {
        window.location.href = waDeep;
        setTimeout(() => { if (!document.hidden) window.location.href = waWeb; }, 700);
        return;
      }

      openNew(waWeb);
    } catch {}
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

        {/* Share actions */}
        <div className="grid grid-cols-2 gap-2 items-center">
          <Button onClick={shareReferralLink} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 px-3 rounded-lg text-sm font-extrabold bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-90 border border-indigo-400/40 w-full">
            <Share2 className="w-4 h-4" />
            <span className="truncate">Share</span>
          </Button>
          <Button onClick={shareToWhatsApp} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 px-2.5 rounded-lg text-[13px] sm:text-sm font-extrabold border text-white shadow-[0_8px_18px_rgba(34,197,94,0.35)] hover:shadow-[0_12px_24px_rgba(34,197,94,0.5)] border-emerald-500/50 bg-[linear-gradient(90deg,#16a34a,#22c55e,#10b981)] w-full">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.471-.148-.67.149-.198.297-.768.966-.941 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.205-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.521.074-.793.372s-1.042 1.016-1.042 2.479 1.067 2.876 1.219 3.074c.149.198 2.1 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.718 2.007-1.41.248-.694.248-1.289.173-1.41-.074-.123-.272-.198-.57-.347m-5.49 7.485h-.004a9.867 9.867 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.861 9.861 0 01-1.51-5.241c.001-5.45 4.434-9.884 9.885-9.884 2.641 0 5.122 1.03 6.988 2.897a9.825 9.825 0 012.897 6.994c-.003 5.45-4.436 9.884-9.887 9.884m8.413-18.297A11.815 11.815 0 0012.004 0C5.375 0 .16 5.215.157 11.844a11.82 11.82 0 001.624 5.99L0 24l6.305-1.654a11.86 11.86 0 005.68 1.448h.005c6.628 0 11.843-5.215 11.846-11.844a11.787 11.787 0 00-3.473-8.372z"/></svg>
            <span className="whitespace-nowrap">WhatsApp</span>
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
