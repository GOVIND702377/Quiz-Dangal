import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Gift, Loader2, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Rewards() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_catalog')
        .select('*')
        .eq('is_active', true);
      if (!mounted) return;
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      setRewards(data || []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [toast]);

  const handleRedeem = async (catalogId) => {
    if (!user) return;
    setRedeeming(catalogId);
    try {
      // Prefer RPC redeem_from_catalog(user_id, catalog_id)
      const { error } = await supabase.rpc('redeem_from_catalog', {
        p_user_id: user.id,
        p_catalog_id: catalogId,
      });
      if (error) throw error;
      toast({ title: 'Redemption requested', description: 'Your reward request is submitted.' });
      navigate('/redemptions');
    } catch (e) {
      toast({ title: 'Redeem failed', description: e.message, variant: 'destructive' });
    } finally {
      setRedeeming(null);
    }
  };

  // REFER & EARN: Native share with fallback links
  const getReferralLink = () => {
    const code = userProfile?.referral_code || user?.id || '';
    return `${window.location.origin}?ref=${encodeURIComponent(code)}`;
  };

  const handleShareInvite = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please login to share your referral link.' });
      navigate('/login');
      return;
    }
    setSharing(true);
    const shareUrl = getReferralLink();
    const shareText = 'Join me on Quiz Dangal — Play daily quizzes, win coins and redeem rewards! Use my link to sign up:';
    try {
      const shareData = { title: 'Quiz Dangal - Refer & Earn', text: `${shareText} ${shareUrl}`, url: shareUrl };

      // Try to attach an app banner if supported
      try {
        const res = await fetch('/android-chrome-512x512.png');
        const blob = await res.blob();
        const file = new File([blob], 'quiz-dangal.png', { type: blob.type || 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
      } catch {}

      if (navigator.share) {
        await navigator.share(shareData);
        toast({ title: 'Thanks for sharing!', description: 'Your referral link has been shared.' });
        setShowShareOptions(false);
      } else {
        // Fallback: copy link and show options
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setShowShareOptions(true);
        setTimeout(() => setCopied(false), 1500);
        toast({ title: 'Link copied', description: 'Share via your favorite app below.' });
      }
    } catch (e) {
      setShowShareOptions(true);
      toast({ title: 'Share failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const shareUrl = getReferralLink();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent('Join me on Quiz Dangal — Play daily quizzes, win coins and redeem rewards!');
  const shareLinks = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Refer & Earn */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <img src="/android-chrome-512x512.png" alt="Quiz Dangal" className="w-12 h-12 rounded-xl" />
            <div>
              <div className="text-lg font-bold text-gray-800">Refer & Earn</div>
              <div className="text-sm text-gray-600">Invite friends, they join — you earn referral rewards</div>
            </div>
          </div>
          <Button onClick={handleShareInvite} className="bg-indigo-600 hover:bg-indigo-700">
            <Share2 className="w-4 h-4 mr-2" /> {sharing ? 'Sharing…' : 'Share Invite'}
          </Button>
        </div>

        {showShareOptions && (
          <div className="mt-4 border-t border-gray-200 pt-3">
            <div className="text-sm text-gray-700 mb-2">Share via:</div>
            <div className="flex flex-wrap gap-2">
              {shareLinks.map((s) => (
                <a key={s.name} href={s.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-gray-50">
                  <ExternalLink className="w-3.5 h-3.5" /> {s.name}
                </a>
              ))}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-gray-50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 mt-2">Tip: Instagram direct share works best via the native share sheet on mobile.</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <Gift className="mr-2" /> Rewards Catalog
          </h1>
          <p className="text-gray-600 text-sm">Redeem your coins for rewards</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/redemptions')}>My Redemptions</Button>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" /> Loading rewards...
          </div>
        ) : rewards.length === 0 ? (
          <div className="py-12 text-center text-gray-600">No rewards available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800">{r.reward_type}: {r.reward_value}</div>
                  <div className="text-sm text-gray-500">Cost: {r.coins_required} coins</div>
                </div>
                <Button
                  onClick={() => handleRedeem(r.id)}
                  disabled={redeeming === r.id}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {redeeming === r.id ? 'Processing...' : 'Redeem'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
