import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { getSignedAvatarUrls } from '@/lib/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trophy, Users, ArrowLeft, Share2 } from 'lucide-react';

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

  // Compose a dynamic Results poster with a clean gradient background (no static poster behind).
  const generateComposedResultsPoster = async () => {
    try {
      // Canvas setup — square fits WhatsApp grid well
      const W = 1080, H = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';

      // Background: clean brand gradient (no external image)
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#130531'); g.addColorStop(1, '#1e0b4b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // Soft vignette overlay for contrast
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

      // Content paddings
      const PAD = 64;

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
      const boxX = PAD, boxY = PAD + 80, boxW = W - PAD*2, boxH = 380;
      const radius = 36;
      const pathRound = (x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath(); };
      // glow
      ctx.save();
      ctx.shadowColor = 'rgba(236,72,153,0.6)';
      ctx.shadowBlur = 28;
      pathRound(boxX, boxY, boxW, boxH, radius);
      ctx.fillStyle = 'rgba(15,23,42,0.72)';
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(236,72,153,0.6)';
      pathRound(boxX, boxY, boxW, boxH, radius); ctx.stroke();

      // Inside box: Rank, Prize, Score (top-based incremental layout)
      let y = boxY + 36;
      const text = (fill, font, content, x, yval, maxW) => {
        ctx.fillStyle = fill; ctx.font = font;
        let s = content;
        if (maxW) { while (s.length > 0 && ctx.measureText(s).width > maxW) s = s.slice(0, -1); if (s !== content) s += '…'; }
        ctx.fillText(s, x, yval);
        const m = ctx.measureText('M');
        // approximate line height from font size
        const fs = parseInt(font.match(/\s(\d+)px/)[1] || '32', 10);
        return fs;
      };
      const maxInner = boxW - 100;
      const rankText = userRank?.rank ? `#${userRank.rank} Rank!` : 'Results Live!';
      y += text('#ffffff', '900 110px Inter, system-ui, -apple-system, Segoe UI, Roboto', rankText, boxX + 48, y, maxInner) + 10;

      const prize = (userRank?.rank && Array.isArray(quiz?.prizes) && quiz.prizes[userRank.rank - 1]) ? quiz.prizes[userRank.rank - 1] : 0;
      y += text('rgba(255,255,255,0.92)', '700 38px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Prize: ₹${prize}`, boxX + 50, y, maxInner) + 8;

      if (typeof userRank?.score === 'number') {
        y += text('rgba(168, 255, 230, 0.95)', '800 58px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Score: ${userRank.score}`, boxX + 50, y, maxInner) + 8;
      }

      const displayName = (userProfile?.username || userProfile?.full_name || 'You').toString();
      y += text('rgba(226,232,240,0.92)', '700 32px Inter, system-ui, -apple-system, Segoe UI, Roboto', `Player: ${displayName}`, boxX + 50, y, maxInner);

      // Tagline near box bottom
      ctx.fillStyle = 'rgba(226,232,240,0.92)';
      ctx.font = '600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('Only legends make it this far ✨', boxX + 50, boxY + boxH - 56);

      // CTA bar
      const ctaY = boxY + boxH + 24; const ctaH = 90;
      ctx.save(); ctx.shadowColor = 'rgba(59,130,246,0.5)'; ctx.shadowBlur = 15;
      pathRound(boxX, ctaY, boxW, ctaH, 22); ctx.fillStyle = 'rgba(2,6,23,0.75)'; ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 2; pathRound(boxX, ctaY, boxW, ctaH, 22); ctx.stroke();
      ctx.fillStyle = 'rgba(250,204,21,0.95)'; ctx.font = '900 40px Inter, system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText('⚡ My Result is Live!', boxX + 36, ctaY + 58);

      // Footer info block
      const footerY = ctaY + ctaH + 24; const footerH = H - footerY - PAD;
      pathRound(boxX, footerY, boxW, footerH, 24); ctx.fillStyle = 'rgba(2,6,23,0.7)'; ctx.fill();
      ctx.strokeStyle = 'rgba(147,51,234,0.45)'; ctx.lineWidth = 2; pathRound(boxX, footerY, boxW, footerH, 24); ctx.stroke();

      const refCode = (userProfile?.referral_code) || ((user?.id || '').replace(/-/g, '').slice(0, 8)).toUpperCase();
      const siteBase = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://quizdangal.com').replace(/\/$/, '');
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = '800 42px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('Play & Win on Quiz Dangal', boxX + 36, footerY + 48);
  ctx.fillStyle = 'rgba(203,213,225,0.98)'; ctx.font = '700 34px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText(siteBase.replace(/^https?:\/\//, ''), boxX + 36, footerY + 48 + 42);
  ctx.fillStyle = 'rgba(190,242,100,1)'; ctx.font = '900 40px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText(`Referral: ${refCode}`, boxX + 36, footerY + 48 + 42 + 48);
  ctx.fillStyle = 'rgba(203,213,225,0.9)'; ctx.font = '600 24px Inter, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('#QuizDangal  #ChallengeAccepted  #PlayToWin', boxX + 36, footerY + footerH - 40);

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
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Compact header */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>{results?.length || 0} participants</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Results</h1>
          <p className="text-xs text-slate-400 truncate">{quiz?.title}</p>
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
                <div key={participant.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${isMe ? 'bg-indigo-950/40 border-indigo-700/40' : 'bg-slate-950/30 border-slate-800 hover:bg-slate-900/60'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${index<3 ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-900 ring-1 ring-amber-200/60' : 'bg-slate-800 text-slate-100 ring-1 ring-white/10'}`}>{index+1}</div>
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => navigate('/my-quizzes')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/70 text-white border border-slate-700 hover:bg-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={shareResultDirect} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold border text-white shadow-[0_8px_18px_rgba(139,92,246,0.4)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.55)] border-violet-500/40 bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)]">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
      </div>
      {/* No ShareSheet dialog — direct device share used */}
    </div>
  );
};

export default Results;