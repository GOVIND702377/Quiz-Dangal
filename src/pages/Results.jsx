import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { getSignedAvatarUrls } from '@/lib/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trophy, Users, ArrowLeft, Share2, Sparkles } from 'lucide-react';

const Results = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isParticipant, setIsParticipant] = useState(true);
  const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [didRefetchAfterCountdown, setDidRefetchAfterCountdown] = useState(false);
  const [posterBlob, setPosterBlob] = useState(null); // cache composed poster for quick share
  // no ShareSheet dialog anymore; direct share only

  // Simple motion variants for smoother entrance
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  useEffect(() => {
    fetchResults();
  }, [quizId]);

  const fetchResults = async () => {
    try {
      setErrorMessage('');
      // Load quiz meta (title, prizes)
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      setQuiz(quizData || null);

      // Check participation unless admin; admins can view all results
      if (userProfile?.role !== 'admin') {
        try {
          const { data: meRow } = await supabase
            .from('quiz_participants')
            .select('status')
            .eq('quiz_id', quizId)
            .eq('user_id', user?.id)
            .maybeSingle();
          const amIn = !!meRow;
          setIsParticipant(amIn);
          if (!amIn) {
            setErrorMessage('You did not participate in this quiz. Results are visible only to participants.');
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Load leaderboard from quiz_results (RLS-safe, shows only to participants)
      const { data: resRow, error: resErr } = await supabase
        .from('quiz_results')
        .select('leaderboard')
        .eq('quiz_id', quizId)
        .maybeSingle();
      if (resErr) throw resErr;

      const leaderboard = Array.isArray(resRow?.leaderboard) ? resRow.leaderboard : [];

      // If results aren't published yet
      if (!resRow || leaderboard.length === 0) {
        setResults([]);
        // Initialize countdown to end_time (results are computed at end_time)
        if (quizData?.end_time) {
          const target = new Date(quizData.end_time).getTime();
          const diff = target - Date.now();
          setTimeLeftMs(diff > 0 ? diff : 0);

          // If end time has passed but results row is missing, try JIT compute
          if (diff <= 0) {
            try {
              await supabase.rpc('compute_results_if_due', { p_quiz_id: quizId });
              // Brief delay and refetch
              await new Promise(r => setTimeout(r, 500));
              const { data: rr2 } = await supabase
                .from('quiz_results')
                .select('leaderboard')
                .eq('quiz_id', quizId)
                .maybeSingle();
              const lb2 = Array.isArray(rr2?.leaderboard) ? rr2.leaderboard : [];
              if (lb2.length > 0) {
                const normalized2 = lb2
                  .map((entry, idx) => ({
                    id: `${quizId}-${entry.user_id}`,
                    user_id: entry.user_id,
                    score: Number(entry.score) || 0,
                    rank: Number(entry.rank) || idx + 1,
                    profiles: { username: entry.display_name?.startsWith('@') ? entry.display_name.slice(1) : undefined, full_name: entry.display_name, avatar_url: undefined },
                  }))
                  .sort((a, b) => b.score - a.score);
                setResults(normalized2);
                setLoading(false);
                return;
              }
            } catch {}
          }
        } else {
          setTimeLeftMs(null);
        }
        return;
      }

      // Normalize structure to what UI expects: rank, score, profiles
      // leaderboard items: { user_id, display_name, score, rank }
      const normalized = leaderboard
        .map((entry, idx) => ({
          id: `${quizId}-${entry.user_id}`,
          user_id: entry.user_id,
          score: Number(entry.score) || 0,
          rank: Number(entry.rank) || idx + 1,
          profiles: {
            username: entry.display_name?.startsWith('@') ? entry.display_name.slice(1) : undefined,
            full_name: entry.display_name,
            avatar_url: undefined,
          },
        }))
        .sort((a, b) => b.score - a.score);

      setResults(normalized);

      // Enrich top entries with avatar/username from profiles (non-blocking)
      try {
        const topIds = normalized.slice(0, 10).map(e => e.user_id);
        if (topIds.length) {
          const { data: profs, error: profError } = await supabase
              .rpc('profiles_public_by_ids', { p_ids: topIds });
            if (profError) {
              console.warn('Public profile fetch failed:', profError);
            }
            if (Array.isArray(profs) && profs.length) {
              const profileMap = new Map(profs.map(p => [p.id, p]));
              const signedMap = await getSignedAvatarUrls(profs.map(p => p.avatar_url).filter(Boolean));
              setResults(prev => prev.map(item => {
                const p = profileMap.get(item.user_id);
                if (!p) return item;
                const signedUrl = p.avatar_url ? (signedMap.get(p.avatar_url) || '') : '';
                return {
                  ...item,
                  profiles: {
                    username: p.username,
                    full_name: p.full_name,
                    avatar_url: signedUrl,
                  },
                };
              }));
          }
        }
      } catch {}

      // Find user's rank
      const me = normalized.find(p => p.user_id === user?.id);
      if (me) setUserRank(me);

    } catch (error) {
      console.error('Error fetching results:', error);
      setErrorMessage(error?.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setErrorMessage('');
    fetchResults();
  };

  // Prepare poster in the background once results are available
  useEffect(() => {
    let cancelled = false;
    const prep = async () => {
      try {
        if (results.length === 0) { setPosterBlob(null); return; }
        const blob = await generateComposedResultsPoster();
        if (!cancelled) setPosterBlob(blob);
      } catch {
        if (!cancelled) setPosterBlob(null);
      }
    };
    prep();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length, quizId, userRank?.rank, userRank?.score]);

  // Removed static background poster; we render a clean gradient background only.

  // Compose a dynamic Results poster styled similar to the provided design (header, neon box, CTA, footer with QR).
  const generateComposedResultsPoster = async () => {
    try {
      // Canvas setup — square fits WhatsApp grid well
      const W = 1080, H = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';

      // Background: deep purple gradient with subtle stars
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#150a36'); g.addColorStop(1, '#0f0926');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Sprinkle some soft dots (bokeh) to mimic the poster ambience
      ctx.save();
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 2 + 0.5;
        ctx.fillStyle = `rgba(173,216,230,${Math.random()*0.5})`;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // Soft vignette overlay for contrast
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

      // Content paddings
  const PAD = 64;

  // Header badge + title and subtitle
  const badgeX = PAD, badgeY = PAD - 6;
  // Circle badge
  ctx.save();
  ctx.beginPath(); ctx.arc(badgeX + 52, badgeY + 52, 52, 0, Math.PI * 2); ctx.closePath();
  const bg1 = ctx.createLinearGradient(badgeX, badgeY, badgeX+104, badgeY+104);
  bg1.addColorStop(0, '#19b1ff'); bg1.addColorStop(1, '#ef47ff');
  ctx.fillStyle = bg1; ctx.fill();
  // Inner trophy glyph (simple)
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath();
  ctx.moveTo(badgeX + 52 - 18, badgeY + 52 - 10);
  ctx.lineTo(badgeX + 52 + 18, badgeY + 52 - 10);
  ctx.lineTo(badgeX + 52 + 12, badgeY + 52 + 18);
  ctx.lineTo(badgeX + 52 - 12, badgeY + 52 + 18);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const name = (userProfile?.full_name || userProfile?.username || 'Your');
  ctx.fillStyle = '#ffd54a'; ctx.font = '900 46px Inter, system-ui';
  ctx.fillText(`${name.toString().toUpperCase()}\u2019S LEGENDARY RUN`, PAD + 120, PAD);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 30px Inter, system-ui';
  ctx.fillText('Brains = Fame', PAD + 120, PAD + 44);
  // Small capsule "Result Box"
  const cap = 'Result Box';
  const capW = ctx.measureText(cap).width + 28; const capH = 36; const capX = PAD + 120; const capY = PAD + 80;
  const roundRect = (x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); };
  ctx.save(); ctx.strokeStyle = '#f0f'; ctx.fillStyle = 'rgba(255,20,147,0.1)'; ctx.lineWidth = 2; roundRect(capX,capY,capW,capH,14); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#e9d5ff'; ctx.font = '800 22px Inter, system-ui'; ctx.fillText(cap, capX + 14, capY + 8);

  // Header: quiz title
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '800 54px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  const title = quiz?.title ? String(quiz.title).toUpperCase() : 'QUIZ DANGAL RESULTS';
  const maxTitleWidth = W - PAD * 2;
  const measure = (t) => ctx.measureText(t).width;
  let titleText = title;
  while (titleText.length > 0 && measure(titleText) > maxTitleWidth) titleText = titleText.slice(0, -1);
  if (titleText !== title) titleText += '…';
  ctx.fillText(titleText, PAD, PAD);

      // Participants count (top-right subtle)
      if (Array.isArray(results)) {
        const partText = `${results.length} participants`;
        ctx.fillStyle = 'rgba(203,213,225,0.85)';
        ctx.font = '600 26px Inter, system-ui, -apple-system, Segoe UI, Roboto';
        const tw = ctx.measureText(partText).width;
        ctx.fillText(partText, W - PAD - tw, PAD);
      }

      // Neon result box
      const boxX = PAD, boxY = PAD + 140, boxW = W - PAD*2, boxH = 380;
      const radius = 36;
      const pathRound = (x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath(); };
      // glow
      ctx.save();
      ctx.shadowColor = 'rgba(255,0,128,0.6)';
      ctx.shadowBlur = 28;
      pathRound(boxX, boxY, boxW, boxH, radius);
      ctx.fillStyle = 'rgba(15,23,42,0.72)';
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,0,128,0.6)';
      pathRound(boxX, boxY, boxW, boxH, radius); ctx.stroke();

      // Inside box: Rank, Prize, Score (top-based incremental layout)
      let y = boxY + 36;
      const text = (fill, font, content, x, yval, maxW) => {
        ctx.fillStyle = fill; ctx.font = font;
        let s = content;
        if (maxW) { while (s.length > 0 && ctx.measureText(s).width > maxW) s = s.slice(0, -1); if (s !== content) s += '…'; }
        ctx.fillText(s, x, yval);
        // approximate line height from font size
        const fs = parseInt(font.match(/\s(\d+)px/)[1] || '32', 10);
        return fs;
      };
      const maxInner = boxW - 100;
      const rankText = userRank?.rank ? `#${userRank.rank} Rank!` : 'Results Live!';
      y += text('#ffffff', '900 120px Inter, system-ui, -apple-system, Segoe UI, Roboto', rankText, boxX + 48, y, maxInner) + 18;

      const prize = (userRank?.rank && Array.isArray(quiz?.prizes) && quiz.prizes[userRank.rank - 1]) ? quiz.prizes[userRank.rank - 1] : 0;
      // Prize line with crown icon shape
      // tiny crown path
      ctx.save(); ctx.fillStyle = '#ffd54a';
      ctx.beginPath();
      const cx = boxX + 50, cy = y + 8;
      ctx.moveTo(cx, cy + 28);
      ctx.lineTo(cx + 6, cy + 12);
      ctx.lineTo(cx + 14, cy + 24);
      ctx.lineTo(cx + 22, cy + 8);
      ctx.lineTo(cx + 30, cy + 24);
      ctx.lineTo(cx + 38, cy + 12);
      ctx.lineTo(cx + 44, cy + 28);
      ctx.closePath(); ctx.fill(); ctx.restore();
      y += text('rgba(255,255,255,0.92)', '800 44px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Prize: ₹${prize}`, boxX + 100, y, maxInner - 50) + 6;

      if (typeof userRank?.score === 'number') {
        y += text('rgba(168, 255, 230, 0.95)', '900 54px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Score: ${userRank.score}`, boxX + 50, y, maxInner) + 10;
      }

      const displayName = (userProfile?.username || userProfile?.full_name || 'You').toString();
      y += text('rgba(226,232,240,0.92)', '700 32px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Player: ${displayName}`, boxX + 50, y, maxInner);

      // Tagline near box bottom
      ctx.fillStyle = 'rgba(226,232,240,0.92)';
      ctx.font = '700 30px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('Only legends make it this far ✨', boxX + 50, boxY + boxH - 60);

      // CTA bar
  const ctaY = boxY + boxH + 24; const ctaH = 96;
  ctx.save(); ctx.shadowColor = 'rgba(147,51,234,0.5)'; ctx.shadowBlur = 18;
  pathRound(boxX, ctaY, boxW, ctaH, 28); ctx.fillStyle = 'rgba(16,12,40,0.85)'; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(147,51,234,0.5)'; ctx.lineWidth = 2; pathRound(boxX, ctaY, boxW, ctaH, 28); ctx.stroke();
  ctx.fillStyle = '#facc15'; ctx.font = '900 44px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('⚡ My Result is Live!', boxX + 36, ctaY + 58);

      // Footer info block
      const footerY = ctaY + ctaH + 24; const footerH = H - footerY - PAD;
      pathRound(boxX, footerY, boxW, footerH, 24); ctx.fillStyle = 'rgba(12,10,36,0.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(79,70,229,0.45)'; ctx.lineWidth = 2; pathRound(boxX, footerY, boxW, footerH, 24); ctx.stroke();

      const refCode = (userProfile?.referral_code) || ((user?.id || '').replace(/-/g, '').slice(0, 8)).toUpperCase();
      const siteBase = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://quizdangal.com').replace(/\/$/, '');
      const referralUrl = `${siteBase}/?ref=${encodeURIComponent(refCode)}`;
      ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.font = '900 46px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('Play & Win on Quiz Dangal', boxX + 36, footerY + 44);
      ctx.fillStyle = 'rgba(203,213,225,0.98)'; ctx.font = '800 36px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText(siteBase.replace(/^https?:\/\//, ''), boxX + 36, footerY + 44 + 44);
      ctx.fillStyle = 'rgba(190,242,100,1)'; ctx.font = '900 44px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText(`Referral: ${refCode}`, boxX + 36, footerY + 44 + 44 + 50);
      ctx.fillStyle = 'rgba(203,213,225,0.92)'; ctx.font = '700 26px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('#QuizDangal   #ChallengeAccepted   #PlayToWin', boxX + 36, footerY + footerH - 40);

      // QR code block on the right
      try {
        const qrSize = 220;
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, referralUrl, { width: qrSize, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        // White card
        const cardW = qrSize + 32; const cardH = qrSize + 40; const cardX = boxX + boxW - cardW - 36; const cardY = footerY + 36;
        roundRect(cardX, cardY, cardW, cardH, 18);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        // Draw QR centered
        ctx.drawImage(qrCanvas, cardX + 16, cardY + 16, qrSize, qrSize);
        // label
        ctx.fillStyle = '#0f172a'; ctx.font = '800 24px Inter, system-ui';
        ctx.fillText('Scan to Play', cardX + 24, cardY + qrSize + 20);
      } catch {
        // if QR generation fails, skip silently.
      }

      // Export as JPEG
      const out = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      return out;
    } catch (e) {
      // Minimal fallback: tiny gradient block as JPEG to keep share flow working
      try {
        const c = document.createElement('canvas'); c.width = 8; c.height = 8; const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 8, 8);
        g.addColorStop(0, '#130531'); g.addColorStop(1, '#1e0b4b');
        ctx.fillStyle = g; ctx.fillRect(0,0,8,8);
        const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
        return jpg;
      } catch { return null; }
    }
  };

  // Direct device share (poster + caption)
  const shareResultDirect = async () => {
    try {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const refCode = (userProfile?.referral_code) || ((user?.id || '').replace(/-/g, '').slice(0, 8));
      const { shareText } = buildSharePayload();
      const captionFull = [
        '🔥 My result is here! 🔥',
        'Checked out the poster? Now it’s your turn 👀',
        '',
        '👉 Just head over to www.quizdangal.com',
        `Use Referral Code: ${refCode}`,
        'and unlock your score 🚀',
        '',
        'Don’t just scroll, share your vibes 💯',
        '#Results #ChallengeAccepted'
      ].join('\n');
      // iOS compact single-line caption (higher chance to stick with image)
      const captionIOS = `My result on Quiz Dangal — Use code: ${refCode} — quizdangal.com`;

      // Always generate customized dynamic poster (fallback is handled inside)
      const poster = posterBlob || (await generateComposedResultsPoster());
      const useBlob = poster; // if null, no file will be attached
      const fname = `quizdangal-result-${quizId}-${userRank?.rank ?? 'NA'}.jpg`;
      const files = useBlob ? [new File([useBlob], fname, { type: 'image/jpeg' })] : [];

      // Pre-copy caption for safety (some apps drop text)
      try { await navigator.clipboard.writeText(isIOS ? captionIOS : captionFull); } catch {}

      // Try sharing with image file first whenever share API exists
      if (typeof navigator.share === 'function') {
        if (files.length > 0) {
          try {
            if (isIOS) {
              await navigator.share({ text: captionIOS, files });
              toast({ title: 'Caption copied', description: 'Agar text nahi gaya ho, paste kar dijiye.' });
            } else {
              await navigator.share({ text: captionFull, files });
            }
            return; // success with files
          } catch (err) {
            // If file-share fails, fall back to text-only share
          }
        }
        try {
          await navigator.share({ text: shareText || captionFull });
          return;
        } catch {}
      }

      // Final fallback: no share API -> keep it non-intrusive (no auto-download). Caption is already copied.
      toast({ title: 'Sharing not supported', description: 'Caption copied. Use WhatsApp button or paste into your app.' });
    } catch (e) {
      toast({ title: 'Share failed', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  // Removed WhatsApp-specific share helper per request

  // Live countdown updater when results aren't available yet
  useEffect(() => {
    if (!quiz?.end_time || results.length > 0) {
      setTimeLeftMs(null);
      return;
    }

    const target = new Date(quiz.end_time).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff > 0) {
        setTimeLeftMs(diff);
      } else {
        setTimeLeftMs(0);
        // One-time refetch once countdown completes
        if (!didRefetchAfterCountdown) {
          setDidRefetchAfterCountdown(true);
          fetchResults();
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.end_time, results.length]);

  const formatTimeParts = (ms) => {
    const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return { days, hours, minutes, seconds };
  };

  // Build share text and URL (with referral)
  const buildSharePayload = () => {
    const refCode = (userProfile?.referral_code) || ((user?.id || '').replace(/-/g, '').slice(0, 8));
    const site = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://quizdangal.com');
    const base = site.replace(/\/$/, '');
    const resultUrl = `${base}/results/${quizId}?ref=${encodeURIComponent(refCode)}`;
    const shareText = userRank
      ? `I scored ${userRank.score} and rank #${userRank.rank} in ${quiz?.title || 'Quiz'} on Quiz Dangal! Play now: ${resultUrl}`
      : `Check out the results of ${quiz?.title || 'Quiz'} on Quiz Dangal! ${resultUrl}`;
    return { refCode, site: base, resultUrl, shareText };
  };

  // Note: We now use a single clean gradient background for the dynamic poster (no secondary poster behind).

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-b"></div>
      </div>
    );
  }

  if (!loading && errorMessage) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="qd-card rounded-2xl p-6 shadow-lg text-center max-w-md w-full text-slate-100">
          <h2 className="text-2xl font-bold mb-2 text-white">Couldn\'t load results</h2>
          <p className="text-slate-300 mb-4">{errorMessage}</p>
          <div className="flex justify-center gap-3">
            <Button variant="brand" onClick={handleRetry}>Retry</Button>
            <Button variant="white" onClick={() => navigate('/my-quizzes')}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="qd-card rounded-2xl p-6 shadow-lg text-center max-w-md w-full text-slate-100">
            <h2 className="text-2xl font-bold mb-2 text-white">Results not published yet</h2>
          {quiz?.end_time ? (
            <div className="mb-4">
              {timeLeftMs > 0 ? (
                <div>
                  <p className="text-slate-300 mb-3">Quiz ends in</p>
                  {(() => {
                    const { days, hours, minutes, seconds } = formatTimeParts(timeLeftMs);
                    const part = (val, label) => (
                      <div className="px-3 py-2 rounded-md bg-slate-800/70 border border-slate-700 min-w-[64px]">
                        <div className="text-xl font-bold text-white tabular-nums">{val.toString().padStart(2,'0')}</div>
                        <div className="text-xs text-slate-400">{label}</div>
                      </div>
                    );
                    return (
                      <div className="flex items-center justify-center gap-2">
                        {days > 0 && part(days, 'Days')}
                        {part(hours, 'Hours')}
                        {part(minutes, 'Minutes')}
                        {part(seconds, 'Seconds')}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-slate-400 mt-3">End time: {new Date(quiz.end_time).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-slate-300 mb-4">Finalizing results… please stay on this page.</p>
              )}
            </div>
          ) : (
            <p className="text-slate-300 mb-4">Please check back after the quiz end time.</p>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="brand" onClick={handleRetry}>Refresh</Button>
            <Button variant="white" onClick={() => navigate('/my-quizzes')}>Back to My Quizzes</Button>
            <Button variant="white" onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24 relative overflow-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      {/* Decorative background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -right-16 w-80 h-80 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-fuchsia-600 to-indigo-600"></div>
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-to-br from-emerald-500 to-cyan-500"></div>
      </div>
      <div className="max-w-4xl mx-auto">
        {/* Modern hero header */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute -inset-1 bg-[conic-gradient(var(--tw-gradient-stops))] from-fuchsia-500/10 via-indigo-500/5 to-cyan-500/10 blur-2xl"></div>
          </div>
          <div className="flex items-center justify-between gap-3 relative">
            <div>
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{results?.length || 0} participants</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" /> Results
              </h1>
              <p className="text-xs text-slate-400 truncate max-w-[90vw]">{quiz?.title}</p>
            </div>
            {userRank?.rank && (
              <div className="shrink-0 text-center">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-200 border border-indigo-600/30 text-xs font-semibold"><Sparkles className="w-3.5 h-3.5"/> You ranked</div>
                <div className="mt-1 text-2xl font-extrabold text-white">#{userRank.rank}</div>
              </div>
            )}
          </div>
        </div>

        {/* Slim user summary */}
        {(userRank && userProfile?.role !== 'admin') && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-600 text-white font-bold flex items-center justify-center ring-1 ring-indigo-300/40">#{userRank.rank}</div>
              <div className="text-xs text-slate-300">
                <div className="text-white font-semibold">Your Result</div>
                <div>Out of {results.length} participants</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-center">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-200 border border-indigo-600/30">YOU</span>
              <div>
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="text-sm font-bold text-emerald-300">{userRank.score}</div>
              </div>
              <div className="min-w-[68px]">
                <div className="text-[11px] text-slate-400">Prize</div>
                <div className="text-sm font-bold text-purple-300">₹{userRank.rank && Array.isArray(quiz?.prizes) && quiz.prizes[userRank.rank-1] ? quiz.prizes[userRank.rank-1] : 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Prize chips */}
        {Array.isArray(quiz?.prizes) && quiz.prizes.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 mb-4 overflow-x-auto whitespace-nowrap">
            {quiz.prizes.map((amount, idx) => (
              <span key={idx} className={`inline-block mr-2 mb-2 px-2.5 py-1 rounded-lg text-xs font-semibold border ${idx===0 ? 'bg-amber-500/10 text-amber-200 border-amber-500/30' : idx===1 ? 'bg-sky-500/10 text-sky-200 border-sky-500/30' : idx===2 ? 'bg-violet-500/10 text-violet-200 border-violet-500/30' : 'bg-slate-800/60 text-slate-200 border-slate-700'}`}>
                {(idx===0 ? '🥇 1st' : idx===1 ? '🥈 2nd' : idx===2 ? '🥉 3rd' : `#${idx+1}`)} • ₹{amount}
              </span>
            ))}
          </div>
        )}

        {/* Leaderboard compact */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" />Leaderboard</div>
          <div className="space-y-2">
            {results.map((participant, index) => {
              const prize = (participant.rank && Array.isArray(quiz?.prizes) && quiz.prizes[participant.rank - 1]) ? quiz.prizes[participant.rank - 1] : 0;
              const isMe = participant.user_id === user?.id;
              return (
                <motion.div key={participant.id} variants={itemVariants} initial="hidden" animate="show" className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${isMe ? 'bg-indigo-950/40 border-indigo-700/40 ring-1 ring-indigo-500/20' : index<3 ? 'bg-slate-900/70 border-slate-700/60' : 'bg-slate-950/30 border-slate-800 hover:bg-slate-900/60'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md grid place-items-center text-xs font-bold bg-slate-800 text-slate-100 ring-1 ring-white/10">
                      <span>{participant.rank || index + 1}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {participant.profiles?.avatar_url ? (
                        <img src={participant.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(participant.profiles?.full_name || participant.profiles?.username || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{participant.profiles?.username || participant.profiles?.full_name || 'Anonymous'}</p>
                      {participant.profiles?.full_name && participant.profiles?.username && (
                        <p className="text-[10px] text-slate-400 truncate">{participant.profiles.full_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-300 leading-none">{participant.score}</p>
                      <p className="text-[10px] text-slate-400 leading-none">Score</p>
                    </div>
                    <div className="text-right min-w-[64px]">
                      <p className="text-sm font-bold text-purple-300 leading-none">₹{prize}</p>
                      <p className="text-[10px] text-slate-400 leading-none">Prize</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Spacer at bottom is handled by pb-24 on wrapper */}
      </div>
      {/* Sticky bottom action bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 shadow-[0_-6px_24px_rgba(0,0,0,0.35)]">
          <div className="max-w-4xl mx-auto px-3 sm:px-4" style={{ paddingTop: 10, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
              <button onClick={() => navigate('/my-quizzes')} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 sm:h-auto px-3 py-3 rounded-lg text-base sm:text-sm font-semibold bg-slate-800/85 text-white border border-slate-700 hover:bg-slate-800 active:translate-y-px transition w-full sm:w-auto">
                <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Back</span>
              </button>
              <button onClick={shareResultDirect} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 sm:h-auto px-4 py-3 rounded-lg text-base sm:text-sm font-extrabold border text-white shadow-[0_8px_18px_rgba(139,92,246,0.4)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.55)] border-violet-500/40 bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)] w-full sm:w-auto">
                <Share2 className="w-5 h-5 sm:w-4 sm:h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      {/* No ShareSheet dialog — direct device share used */}
    </div>
  );
};

export default Results;