import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from '@/lib/motion-lite';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';
import { getSignedAvatarUrls } from '@/lib/avatar';
import { getPrizeDisplay, shouldAllowClientCompute, safeComputeResultsIfDue } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trophy, Users, ArrowLeft, Share2, Sparkles, ListChecks, BookOpenCheck } from 'lucide-react';
import { normalizeReferralCode, saveReferralCode } from '@/lib/referralStorage';
import SEO from '@/components/SEO';

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
  // Removed isParticipant (no longer needed for gating rendering)
  const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [didRefetchAfterCountdown, setDidRefetchAfterCountdown] = useState(false);
  const [posterBlob, setPosterBlob] = useState(null); // cache composed poster for quick share
  const [participantsCount, setParticipantsCount] = useState(0);
  // Q&A review for non-opinion categories
  const [qaItems, setQaItems] = useState([]); // [{ id, question_text, options: [{id, option_text, is_correct, isSelected}] }]
  const [showQA, setShowQA] = useState(false);
  // no ShareSheet dialog anymore; direct share only
  const isAdmin = userProfile?.role === 'admin';

  // Simple motion variants for smoother entrance
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  const fetchResults = useCallback(async () => {
    if (!hasSupabaseConfig || !supabase) {
      setErrorMessage('Results are unavailable right now.');
      setLoading(false);
      return;
    }
    try {
      setErrorMessage('');
      // Load quiz meta (title, prizes)
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      if (quizError) throw quizError;
  setQuiz(quizData || null);

      // Participation check (non-blocking): we still show public results if available
      let amParticipant = false;
      if (user?.id) {
        try {
          const { data: meRow } = await supabase
            .from('quiz_participants')
            .select('status')
            .eq('quiz_id', quizId)
            .eq('user_id', user?.id)
            .maybeSingle();
          amParticipant = !!meRow;
        } catch {
          amParticipant = false;
        }
      }

      const allowClientCompute = isAdmin || amParticipant || shouldAllowClientCompute({ defaultValue: true });

      // Load leaderboard from quiz_results (RLS-safe)
      const { data: resRow, error: resErr } = await supabase
        .from('quiz_results')
        .select('leaderboard')
        .eq('quiz_id', quizId)
        .maybeSingle();
      if (resErr) throw resErr;

      let leaderboard = Array.isArray(resRow?.leaderboard) ? resRow.leaderboard : [];

      // If results aren't published yet
      if (!resRow || leaderboard.length === 0) {
        setResults([]);
        // Initialize countdown to end_time (results are computed at end_time)
        if (quizData?.end_time) {
          const target = new Date(quizData.end_time).getTime();
          const diff = target - Date.now();
          setTimeLeftMs(diff > 0 ? diff : 0);

          // If end time has passed but results row is missing, try JIT compute
          if (diff <= 0 && allowClientCompute) {
            try {
              await safeComputeResultsIfDue(supabase, quizId, { throttleMs: 150 });
              // Brief delay and refetch
              await new Promise(r => setTimeout(r, 400));
              const { data: rr2 } = await supabase
                .from('quiz_results')
                .select('leaderboard')
                .eq('quiz_id', quizId)
                .maybeSingle();
              const lb2 = Array.isArray(rr2?.leaderboard) ? rr2.leaderboard : [];
              if (lb2.length > 0) {
                leaderboard = lb2;
              }
            } catch (computeError) {
              if (import.meta.env.DEV) {
                console.debug('compute_results_if_due failed; continuing with original data', computeError);
              }
            }
            // End time passed: treat as published even if leaderboard empty
            // Do not return; continue to render Results with empty list
          } else if (diff > 0) {
            // Before end: show waiting UI
            return;
          }
        } else {
          setTimeLeftMs(null);
          // No end_time meta; treat as unpublished and show waiting UI
          return;
        }
        // Past end: continue and render Results with empty list
      } else {
        setTimeLeftMs(null);
      }

  // Normalize structure to what UI expects: rank, score, profiles
      // leaderboard items: { user_id, display_name, score, rank }
      const normalized = (Array.isArray(leaderboard) ? leaderboard : [])
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
      if (normalized.length > 0 && didRefetchAfterCountdown) {
        setDidRefetchAfterCountdown(false);
      }

      // Fetch participants count for header via engagement RPC (non-blocking)
      try {
        const { data: ec } = await supabase.rpc('get_engagement_counts', { p_quiz_id: quizId });
        const rec = Array.isArray(ec) ? ec[0] : ec;
        const joined = Number(rec?.joined ?? 0);
        const pre = Number(rec?.pre_joined ?? 0);
        setParticipantsCount(joined + pre);
      } catch { /* ignore */ }

      // Fetch Q&A review for non-opinion categories (publicly visible after end)
      try {
        const category = (quizData?.category || '').toLowerCase();
        const isOpinion = category === 'opinion';
        if (!isOpinion && quizId) {
          // Load all questions with options and correctness
          const { data: qrows, error: qerr } = await supabase
            .from('questions')
            .select('id, question_text, options ( id, option_text, is_correct )')
            .eq('quiz_id', quizId)
            .order('id');
          if (qerr) throw qerr;
          let selectionsMap = new Map();
          if (user?.id && Array.isArray(qrows) && qrows.length > 0) {
            const qids = qrows.map(q => q.id);
            const { data: uans } = await supabase
              .from('user_answers')
              .select('question_id, selected_option_id')
              .in('question_id', qids)
              .eq('user_id', user.id);
            if (Array.isArray(uans)) {
              selectionsMap = new Map(uans.map(r => [r.question_id, r.selected_option_id]));
            }
          }
          const mapped = (qrows || []).map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: (q.options || []).map(o => ({
              id: o.id,
              option_text: o.option_text,
              is_correct: !!o.is_correct,
              isSelected: selectionsMap.get(q.id) === o.id,
            })),
          }));
          setQaItems(mapped);
        } else {
          setQaItems([]);
        }
      } catch (e) {
        // If RLS prevents reading correctness, just skip Q&A review
        if (import.meta.env.DEV) console.debug('Q&A review unavailable:', e?.message || e);
        setQaItems([]);
      }

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
      } catch {
        // Non-critical: avatar enrichment failed; continue with base leaderboard
      }

      // Find user's rank
      const me = normalized.find(p => p.user_id === user?.id);
      if (me) setUserRank(me);
      if (!amParticipant) {
        // If viewer is not a participant, still allow viewing. Do not set error.
      }

    } catch (error) {
      console.error('Error fetching results:', error);
      setErrorMessage(error?.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }, [quizId, user?.id, isAdmin, didRefetchAfterCountdown]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

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

  const prizeType = quiz?.prize_type || 'coins';
  const userPrizeVal = (userRank?.rank && Array.isArray(quiz?.prizes) && quiz.prizes[userRank.rank - 1]) ? quiz.prizes[userRank.rank - 1] : 0;
  const userPrizeDisplay = getPrizeDisplay(prizeType, userPrizeVal, { fallback: 0 });

  // Compose a dynamic Results poster (portrait-only) with strict flow and QR footer
  const generateComposedResultsPoster = async () => {
    try {
      const W = 1080, H = 1920;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'); ctx.textBaseline = 'top';
      const fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
      const setFont = (weight, sizePx) => { ctx.font = `${weight} ${sizePx}px ${fontFamily}`; };
      const measureW = (t) => ctx.measureText(t).width;
      const fitFontSize = (text, maxW, weight, start, min) => { let s = start; setFont(weight, s); while (s > min && measureW(text) > maxW) { s -= 2; setFont(weight, s); } return s; };
      const wrapText = (text, maxW, weight, size) => { setFont(weight, size); const words = String(text).split(/\s+/); const lines=[]; let cur=''; for (const w of words){ const trial = cur?cur+' '+w:w; if (measureW(trial)<=maxW) cur=trial; else { if(cur) lines.push(cur); cur=w; } } if (cur) lines.push(cur); return lines; };
      const drawCenteredWrapped = (text, xCenter, yStart, maxW, weight, start, min, maxLines, color) => { let size = start; let lines = wrapText(text, maxW, weight, size); while ((lines.length>maxLines || lines.some(l=>measureW(l)>maxW)) && size>min){ size-=1; lines=wrapText(text,maxW,weight,size);} setFont(weight,size); ctx.fillStyle=color; const lh=Math.round(size*1.25); const used=Math.min(maxLines,lines.length); for(let i=0;i<used;i++){ const line=lines[i]; const lw=measureW(line); ctx.fillText(line, xCenter-lw/2, yStart+i*lh);} return { height: used*lh, size } };
      const trimToWidth = (text, maxW) => { let s=String(text); while(s && measureW(s)>maxW) s=s.slice(0,-1); return s.length < String(text).length ? s.slice(0, Math.max(0, s.length-1)) + '…' : s; };
      const loadImage = (src) => new Promise((resolve, reject)=>{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>resolve(img); img.onerror=reject; img.src=src; });
      const roundRect = (x,y,w,h,r)=>{ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); };

      // Background gradient
      const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#150a36'); g.addColorStop(1,'#0f0926'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

      const PAD=64, cxMid=W/2; let y = PAD + 12;
      // Big top logo in gradient circle
    const badgeR=140, badgeCY=y+badgeR; ctx.save(); ctx.beginPath(); ctx.arc(cxMid,badgeCY,badgeR,0,Math.PI*2); ctx.closePath(); const bg1=ctx.createLinearGradient(cxMid-badgeR,badgeCY-badgeR,cxMid+badgeR,badgeCY+badgeR); bg1.addColorStop(0,'#1cc5ff'); bg1.addColorStop(1,'#ef47ff'); ctx.fillStyle=bg1; ctx.fill();
  try { const posterLogoSetting = (import.meta.env.VITE_POSTER_LOGO_URL || '').trim(); const posterLogo = posterLogoSetting || '/android-chrome-192x192.png'; let logo; try { logo=await loadImage(posterLogo); } catch (e) { logo=await loadImage('/android-chrome-192x192.png'); } const inset=16; const d=(badgeR*2)-inset; ctx.save(); ctx.beginPath(); ctx.arc(cxMid,badgeCY,badgeR-inset/2,0,Math.PI*2); ctx.clip(); ctx.drawImage(logo, Math.round(cxMid-d/2), Math.round(badgeCY-d/2), Math.round(d), Math.round(d)); ctx.restore(); ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cxMid,badgeCY,badgeR-inset/2,0,Math.PI*2); ctx.stroke(); } catch (e) { /* badge logo draw fail */ }
      ctx.restore(); y = badgeCY + badgeR + 18;

      // Header + subtitle
      const name = (userProfile?.full_name || userProfile?.username || 'Your').toString().toUpperCase();
      const headerText = `🏅 ${name}\u2019S LEGENDARY RUN 🏅`;
      const h1 = drawCenteredWrapped(headerText, cxMid, y, W - PAD*2, '900', 56, 34, 2, '#ffd54a'); y += h1.height + 16;
      const sub = drawCenteredWrapped('✨ Brains = Fame ✨', cxMid, y, W - PAD*2, '700', 36, 22, 1, 'rgba(255,255,255,0.9)'); y += sub.height + 28;

      // Results box
      const boxX=PAD, boxW=W-PAD*2, lineLeft=boxX+56; const boxTopPad=48, boxBotPad=40;
      const rankText = userRank?.rank ? `#${userRank.rank} Rank!` : 'Results Live!';
    const prizeDisplay = getPrizeDisplay(prizeType, userPrizeVal, { fallback: 0 });
    const prizeText = `👑 Prize: ${prizeDisplay.formatted}`;
      const scoreText = typeof userRank?.score === 'number' ? `☑️ Score: ${userRank.score}` : '';
      const rankSize=fitFontSize(rankText, boxW-100, '900', 112, 80);
      const prizeSize=fitFontSize(prizeText, boxW-100, '900', 48, 32);
      const scoreSize=scoreText?fitFontSize(scoreText, boxW-100, '900', 44, 28):0;
      const innerH = Math.round(rankSize*1.0)+24+Math.round(prizeSize*1.15)+12+(scoreText?Math.round(scoreSize*1.15)+12:0);
      const boxH = boxTopPad + innerH + boxBotPad; const boxY = y;
      const gradStroke = ctx.createLinearGradient(boxX,boxY,boxX+boxW,boxY); gradStroke.addColorStop(0,'rgba(34,211,238,0.9)'); gradStroke.addColorStop(1,'rgba(236,72,153,0.9)');
      ctx.save(); roundRect(boxX, boxY, boxW, boxH, 36); ctx.fillStyle='rgba(15,23,42,0.72)'; ctx.fill(); ctx.lineWidth=4; ctx.strokeStyle=gradStroke; ctx.stroke(); ctx.restore();
      let ry = boxY + boxTopPad; setFont('900', rankSize); ctx.fillStyle='#ffffff'; ctx.fillText(rankText, lineLeft, ry); ry += Math.round(rankSize*1.0)+24; setFont('900',prizeSize); ctx.fillStyle='#ffd54a'; ctx.fillText(prizeText, lineLeft, ry); ry += Math.round(prizeSize*1.15)+12; if (scoreText){ setFont('900', scoreSize); ctx.fillStyle='rgba(168,255,230,0.95)'; ctx.fillText(scoreText, lineLeft, ry); ry += Math.round(scoreSize*1.15)+12; }
      y = boxY + boxH + 28;

      // CTA area with reserved footer space
      const footerMin = 230; const availForCta = Math.max(120, (H - PAD - footerMin) - y);
      const ctaMain='⚡ My Result is Live!'; const ctaSize = fitFontSize(ctaMain, boxW - 120, '900', 48, 26);
      const quote='“Think you can beat me? Join Quiz Dangal & prove it 👀”'; const quoteSize=26; const quoteLH=Math.round(quoteSize*1.25);
      setFont('700', quoteSize); const quoteLines = wrapText(quote, boxW - 120, '700', quoteSize).slice(0,2); const quoteH = quoteLines.length*quoteLH; let ctaH = 28 + Math.round(ctaSize) + 12 + quoteH + 28; if (ctaH > availForCta) ctaH = availForCta;
      const ctaY = y; roundRect(boxX, ctaY, boxW, ctaH, 28); ctx.fillStyle='rgba(8,11,30,0.9)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(56,189,248,0.5)'; ctx.stroke();
      setFont('900', ctaSize); ctx.fillStyle='#facc15'; const ctw=measureW(ctaMain); ctx.fillText(ctaMain, cxMid - ctw/2, ctaY + 28);
      setFont('700', quoteSize); ctx.fillStyle='rgba(226,232,240,0.92)'; let qy = ctaY + 28 + Math.round(ctaSize) + 12; for (const l of quoteLines){ const lw=measureW(l); ctx.fillText(l, cxMid - lw/2, qy); qy += quoteLH; }
      y = ctaY + ctaH + 24;

      // Footer with QR
  const footerY = y; const footerH = Math.max(footerMin, Math.min(280, H - PAD - footerY)); roundRect(boxX, footerY, boxW, footerH, 24); ctx.fillStyle='rgba(12,10,36,0.9)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(79,70,229,0.45)'; ctx.stroke();
  const fallbackRef = (() => {
    if (userProfile?.referral_code) return userProfile.referral_code;
    if (user?.id) return user.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return '';
  })();
  const refCode = normalizeReferralCode(fallbackRef);
  const siteBase = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.quizdangal.com').replace(/\/$/, '');
  const referralUrl = `${siteBase}/?ref=${encodeURIComponent(refCode)}`;
  if (refCode) {
    saveReferralCode(refCode);
  }
  const qrSize = Math.min(220, footerH - 72); const cardW = qrSize + 32; const cardH = qrSize + 40; const cardX = boxX + boxW - cardW - 36; const cardY = footerY + Math.max(24, Math.round((footerH - cardH)/2)); roundRect(cardX, cardY, cardW, cardH, 18); ctx.fillStyle='#ffffff'; ctx.fill(); try { const { default: QRCode } = await import('qrcode'); const qrCanvas=document.createElement('canvas'); await QRCode.toCanvas(qrCanvas, referralUrl, { width: qrSize, margin: 1, color: { dark:'#000000', light:'#ffffff' } }); ctx.drawImage(qrCanvas, cardX+16, cardY+16, qrSize, qrSize); } catch { /* QR generation failed: leave blank */ }
  const leftX = boxX + 36; const maxLeft = (cardX - 24) - leftX; ctx.fillStyle='rgba(255,255,255,0.96)'; setFont('900',48); ctx.fillText(trimToWidth('🧠 Play & Win', maxLeft), leftX, footerY + 36);
  ctx.fillStyle='rgba(203,213,225,0.98)'; setFont('800',36); ctx.fillText(trimToWidth('🌐 www.quizdangal.com', maxLeft), leftX, footerY + 36 + 54);
  setFont('900',44); ctx.fillStyle='rgba(255,255,255,0.96)'; const lbl='🔗 Referral: '; const lblW=measureW(lbl); ctx.fillText(trimToWidth(lbl, maxLeft), leftX, footerY + 36 + 54 + 62); ctx.fillStyle='rgba(0,255,198,1)'; ctx.fillText(trimToWidth(refCode, Math.max(0, maxLeft - lblW - 8)), leftX + lblW, footerY + 36 + 54 + 62);
  setFont('700',26); ctx.fillStyle='rgba(226,232,240,0.92)'; ctx.fillText(trimToWidth('Your turn to flex your brain 💯', maxLeft), leftX, footerY + footerH - 80);
  setFont('700',24); ctx.fillStyle='rgba(203,213,225,0.92)'; ctx.fillText(trimToWidth('#QuizDangal  #ChallengeAccepted  #PlayToWin', maxLeft), leftX, footerY + footerH - 44);

      const out = await new Promise((res)=>canvas.toBlob(res,'image/jpeg',0.92)); return out;
    } catch {
      try { const c=document.createElement('canvas'); c.width=8; c.height=8; const ctx=c.getContext('2d'); const g=ctx.createLinearGradient(0,0,8,8); g.addColorStop(0,'#130531'); g.addColorStop(1,'#1e0b4b'); ctx.fillStyle=g; ctx.fillRect(0,0,8,8); const jpg=await new Promise((res)=>c.toBlob(res,'image/jpeg',0.9)); return jpg; } catch { return null; }
    }
  };

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
  }, [quiz?.end_time, results.length, didRefetchAfterCountdown, fetchResults]);

  useEffect(() => {
    if (results.length > 0) return;
    if (!hasSupabaseConfig || !supabase) return;
    if (!quizId) return;
    if (typeof window === 'undefined') return;

    // Realtime enable flag (can be disabled via env)
    const enableRealtime = (() => {
      try {
        const runtimeEnv = (typeof window !== 'undefined' && window.__QUIZ_DANGAL_ENV__) ? window.__QUIZ_DANGAL_ENV__ : {};
        const raw = import.meta.env.VITE_ENABLE_REALTIME ?? runtimeEnv.VITE_ENABLE_REALTIME ?? (import.meta.env.DEV ? '0' : '0');
        const v = String(raw).toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
      } catch { return false; }
    })();

    const shouldUseRealtime = () => {
      try {
        if (!enableRealtime) return false;
        if (!hasSupabaseConfig || !supabase || !quizId) return false;
        if (typeof window === 'undefined') return false;
        if (!('WebSocket' in window)) return false;
        if (navigator && navigator.onLine === false) return false;
        // Avoid WS on hidden tabs to reduce transient closures
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
        // Heuristic: on insecure contexts some browsers can be stricter
        if (typeof window !== 'undefined' && window.isSecureContext === false) return false;
        const conn = (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
        if (conn) {
          if (conn.saveData) return false;
          if (typeof conn.effectiveType === 'string' && /(^|\b)2g(\b|$)/i.test(conn.effectiveType)) return false;
        }
        return true;
      } catch { return true; }
    };

    if (!shouldUseRealtime()) {
      return; // rely on polling/fetchResults from other effects
    }

    let channel = null;
    let cleanupTimer = null;
    try {
      channel = supabase
        .channel(`quiz-results-${quizId}`, { config: { broadcast: { ack: false } } })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quiz_results', filter: `quiz_id=eq.${quizId}` },
          () => {
            fetchResults();
          },
        )
        .subscribe((status) => {
          // Silently handle subscription status
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // Cleanup failed channel to prevent console errors
            try {
              if (channel) supabase.removeChannel(channel);
            } catch { /* ignore */ }
          }
        });

      // If the channel didn't join promptly, clean it up to avoid noisy console errors
      cleanupTimer = setTimeout(() => {
        try {
          if (channel && channel.state !== 'joined') {
            supabase.removeChannel(channel);
            channel = null;
          }
        } catch { /* ignore */ }
      }, 5000);
    } catch {
      // ignore realtime setup errors; fetch fallback will cover
    }

    return () => {
      try {
        if (cleanupTimer) clearTimeout(cleanupTimer);
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [quizId, results.length, fetchResults]);

  const formatTimeParts = (ms) => {
    const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return { days, hours, minutes, seconds };
  };

  // Build share text and URL (with referral)
  // buildSharePayload removed (poster-only sharing flow now)

  // Direct device share with poster only (no text)
  const shareResultDirect = async () => {
    try {
      let blob = posterBlob;
      if (!blob) blob = await generateComposedResultsPoster();
      if (blob && navigator.canShare && window.File) {
        const file = new File([blob], 'quiz-dangal-result.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Quiz Dangal Result' });
          toast({ title: 'Shared!', description: 'Poster shared from your device.' });
          return;
        }
      }
      // Fallback: download poster so user can share manually
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'quiz-dangal-result.jpg'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast({ title: 'Poster saved', description: 'Share the image from your gallery.' });
        return;
      }
      toast({ title: 'Share unavailable', description: 'Try again after poster is ready.' });
    } catch (e) {
      toast({ title: 'Share failed', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  // WhatsApp share: poster image only
  const shareToWhatsApp = async () => {
    try {
      let blob = posterBlob;
      if (!blob) blob = await generateComposedResultsPoster();
      // Try to share file via Web Share so user can pick WhatsApp with just the image
      if (blob && navigator.canShare && window.File) {
        const file = new File([blob], 'quiz-dangal-result.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Quiz Dangal Result' });
          return;
        }
      }

      // Fallback: save image and open WhatsApp app without text; user attaches from gallery
      if (blob) {
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'quiz-dangal-result.jpg'; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch {
          // Silent fallback: if download fails we still proceed to open WhatsApp
        }
      }
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const waDeep = `whatsapp://send`;
      const intentUrl = `intent://send#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      const waWeb = `https://wa.me/`;
      const openNew = (url) => { const w = window.open(url, '_blank'); return !!w; };
      if (isAndroid) { if (openNew(waDeep)) return; window.location.href = intentUrl; setTimeout(() => { if (!document.hidden) window.location.href = waWeb; }, 700); return; }
      if (isIOS) { window.location.href = waDeep; setTimeout(() => { if (!document.hidden) window.location.href = waWeb; }, 700); return; }
      openNew(waWeb);
    } catch (e) {
      toast({ title: 'WhatsApp share failed', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  // Note: We now use a single clean gradient background for the dynamic poster (no secondary poster behind).

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SEO
          title="Results – Loading | Quiz Dangal"
          description="Loading quiz results."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/results/${quizId}` : 'https://quizdangal.com/results'}
          robots="noindex, nofollow"
        />
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent-b"></div>
      </div>
    );
  }

  if (!loading && errorMessage) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <SEO
          title="Results – Error | Quiz Dangal"
          description={errorMessage || 'Could not load results.'}
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/results/${quizId}` : 'https://quizdangal.com/results'}
          robots="noindex, nofollow"
        />
        <div className="qd-card rounded-2xl p-6 shadow-lg text-center max-w-md w-full text-slate-100">
          <h2 className="text-2xl font-bold mb-2 text-white">Couldn&apos;t load results</h2>
          <p className="text-slate-300 mb-4">{errorMessage}</p>
          <div className="flex justify-center gap-3">
            <Button variant="brand" onClick={handleRetry}>Retry</Button>
            <Button variant="white" onClick={() => navigate('/my-quizzes/')}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && (timeLeftMs ?? 0) > 0 && results.length === 0) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <SEO
          title="Results – Not Published | Quiz Dangal"
          description="Results will be available after the quiz ends."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/results/${quizId}` : 'https://quizdangal.com/results'}
          robots="noindex, nofollow"
        />
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24 relative overflow-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <SEO
        title={`${quiz?.title ? `${quiz.title} – Results` : 'Quiz Results'} | Quiz Dangal`}
        description={results.length > 0 ? 'Leaderboard and winners for this quiz.' : 'Results are finalized.'}
        canonical={typeof window !== 'undefined' ? `${window.location.origin}/results/${quizId}` : 'https://quizdangal.com/results'}
        robots="noindex, nofollow"
      />
      <style>{`.results-prize-row::-webkit-scrollbar{display:none;}`}</style>
      {/* Decorative background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -right-16 w-80 h-80 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-fuchsia-600 to-indigo-600"></div>
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-to-br from-emerald-500 to-cyan-500"></div>
      </div>
      <div className="max-w-4xl mx-auto">
        {/* Results header wrapped in a decorative blue box (restored) */}
        <div className="px-1 sm:px-1.5 pt-1 pb-2 sm:pt-1.5 sm:pb-3">
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-3 sm:p-4 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute -inset-1 bg-[conic-gradient(var(--tw-gradient-stops))] from-indigo-500/12 via-fuchsia-500/10 to-cyan-500/12 blur-2xl"></div>
            </div>
            <div className="relative">
              <div className="flex items-start justify-between gap-3 flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-slate-300 text-xs">
                    <Users className="w-3.5 h-3.5" />
                    <span>{participantsCount || results?.length || 0} participants</span>
                  </div>
                  <h1 className="text-[22px] sm:text-[26px] font-extrabold text-white tracking-tight flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-300" /> Results
                  </h1>
                  <p className="text-[12px] sm:text-sm text-slate-400 truncate max-w-[65vw] sm:max-w-sm">{quiz?.title}</p>
                </div>
                {userRank?.rank && (
                  <div className="shrink-0 text-right pl-1 self-start relative z-10">
                    <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><Sparkles className="w-4 h-4"/>You ranked</div>
                    <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">#{userRank.rank}</div>
                  </div>
                )}
              </div>
              {Array.isArray(quiz?.prizes) && quiz.prizes.length > 0 && (
                <div className="results-prize-row mt-2 flex items-center gap-1.5 flex-nowrap overflow-x-auto sm:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] relative z-0">
                  {quiz.prizes.map((amount, idx) => {
                    const prizeDisplay = getPrizeDisplay(prizeType, amount, { fallback: 0 });
                    const base = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border shadow-sm backdrop-blur-sm whitespace-nowrap';
                    const palette = idx === 0
                      ? 'bg-amber-500/15 text-amber-100 border-amber-500/35'
                      : idx === 1
                        ? 'bg-sky-500/15 text-sky-100 border-sky-500/35'
                        : idx === 2
                          ? 'bg-violet-500/15 text-violet-100 border-violet-500/35'
                          : 'bg-slate-800/70 text-slate-200 border-slate-700/60';
                    return (
                      <span key={idx} className={`${base} ${palette}`}>
                        <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                        <span>{idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : 'Prize'}</span>
                        <span>{prizeDisplay.formatted}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Slim user summary (restored) */}
        {(userRank && userProfile?.role !== 'admin') && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 mt-4 mb-5">
            <div className="flex items-center justify-between gap-3 flex-nowrap text-[10px] sm:text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-600 text-white font-bold flex items-center justify-center ring-1 ring-indigo-300/40">#{userRank.rank}</div>
                <div className="leading-tight min-w-0">
                  <div className="text-[12px] sm:text-sm font-semibold text-white">Your Result</div>
                  <div className="text-[11px] sm:text-xs text-slate-300 truncate">Out of {results.length} participants</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <div className="flex flex-col items-end min-w-[60px]">
                  <span className="uppercase text-[9px] sm:text-[10px] tracking-wide text-slate-400">Score</span>
                  <span className="text-[15px] sm:text-base font-bold text-emerald-300 leading-tight">{userRank.score}</span>
                </div>
                <div className="flex flex-col items-end min-w-[78px]">
                  <span className="uppercase text-[9px] sm:text-[10px] tracking-wide text-slate-400">Prize</span>
                  <span className="text-[15px] sm:text-base font-bold text-purple-300 leading-tight">{userPrizeDisplay.formatted}</span>
                </div>
              </div>
            </div>
            {(qaItems?.length || 0) > 0 && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowQA(v => !v)}
                  className={`group relative inline-flex items-center gap-2 h-10 px-3.5 rounded-full border text-white text-[12px] font-semibold transition
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60
                    ${showQA ? 'bg-emerald-600/15 border-emerald-400/40 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]' : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-900/75 hover:shadow-[0_8px_22px_rgba(16,185,129,0.2)]'}`}
                  title="View Questions & Answers"
                  aria-expanded={showQA}
                >
                  <span className="absolute -inset-px rounded-full opacity-0 group-hover:opacity-100 transition" aria-hidden="true"
                        style={{ background: 'conic-gradient(from 180deg at 50% 50%, rgba(16,185,129,0.18), rgba(6,182,212,0.14), rgba(16,185,129,0.18))' }}></span>
                  <span className="relative inline-flex items-center justify-center rounded-full p-1.5 bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)]">
                    <BookOpenCheck className="w-3.5 h-3.5" />
                  </span>
                  <span className="relative">Questions &amp; Answers</span>
                </button>
              </div>
            )}
          </div>
        )}

        {showQA && (qaItems?.length || 0) > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2"><ListChecks className="w-4 h-4 text-emerald-300"/>Questions & Answers</div>
              <button
                type="button"
                onClick={() => setShowQA(false)}
                className="text-[11px] sm:text-xs text-slate-300 hover:text-white"
              >Close</button>
            </div>
            <div className="space-y-3">
              {qaItems.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-[13px] sm:text-sm font-semibold text-white mb-2">
                    <span className="text-slate-400 mr-1">Q{idx + 1}.</span>{q.question_text}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((o) => {
                      const isCorrect = !!o.is_correct;
                      const isSelected = !!o.isSelected;
                      const base = 'px-2.5 py-2 rounded-md border text-[12px] sm:text-[13px]';
                      const palette = isCorrect
                        ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-200'
                        : isSelected
                          ? 'bg-rose-600/20 border-rose-500/35 text-rose-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300';
                      return (
                        <div key={o.id} className={`${base} ${palette}`}>
                          <div className="flex items-center gap-2">
                            {isCorrect && <span className="text-emerald-300">✓</span>}
                            {isSelected && !isCorrect && <span className="text-rose-300">•</span>}
                            <span>{o.option_text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard compact */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" />Leaderboard</div>
          <div className="space-y-2">
            {results.length === 0 && (
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-700/60 text-slate-300 text-sm">
                No participants or no valid answers. Results are finalized.
              </div>
            )}
            {results.map((participant, index) => {
              const prizeVal = (participant.rank && Array.isArray(quiz?.prizes) && quiz.prizes[participant.rank - 1]) ? quiz.prizes[participant.rank - 1] : 0;
              const prizeDisplay = getPrizeDisplay(prizeType, prizeVal, { fallback: 0 });
              const isMe = participant.user_id === user?.id;
              return (
                <m.div key={participant.id} variants={itemVariants} initial="hidden" animate="show" className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${isMe ? 'bg-indigo-950/40 border-indigo-700/40 ring-1 ring-indigo-500/20' : index<3 ? 'bg-slate-900/70 border-slate-700/60' : 'bg-slate-950/30 border-slate-800 hover:bg-slate-900/60'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md grid place-items-center text-xs font-bold bg-slate-800 text-slate-100 ring-1 ring-white/10">
                      <span>{participant.rank || index + 1}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {participant.profiles?.avatar_url ? (
                        <img src={participant.profiles.avatar_url} alt={participant.profiles.full_name ? `${participant.profiles.full_name} avatar` : 'User avatar'} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 whitespace-nowrap">
                    <div className="text-right min-w-[52px]">
                      <p className="text-[10px] text-slate-400 leading-none mb-0.5">Score</p>
                      <p className="text-sm sm:text-base font-bold text-emerald-300 leading-none">{participant.score}</p>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-[10px] text-slate-400 leading-none mb-0.5">Prize</p>
                      <p className="text-sm sm:text-base font-bold text-purple-300 leading-none flex items-center justify-end gap-1">
                        <span>{prizeDisplay.formatted}</span>
                      </p>
                    </div>
                  </div>
                </m.div>
              );
            })}
          </div>
        </div>

        {/* Q&A rendered above leaderboard via toggle; duplicate section removed */}

        {/* Spacer at bottom is handled by pb-24 on wrapper */}
      </div>
      {/* Sticky bottom action bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 shadow-[0_-6px_24px_rgba(0,0,0,0.35)]">
          <div className="max-w-4xl mx-auto px-3 sm:px-4" style={{ paddingTop: 10, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
            <div className="grid grid-cols-3 gap-2 items-center">
              <button
                onClick={() => navigate('/my-quizzes/')}
                className="col-span-1 inline-flex items-center justify-center gap-2 h-12 px-3 rounded-lg text-sm font-semibold bg-slate-800/85 text-white border border-slate-700 hover:bg-slate-800 active:translate-y-px transition w-full min-w-0"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                <span className="truncate">Back</span>
              </button>
              <button onClick={shareToWhatsApp} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 px-2.5 rounded-lg text-[13px] sm:text-sm font-extrabold border text-white shadow-[0_8px_18px_rgba(34,197,94,0.35)] hover:shadow-[0_12px_24px_rgba(34,197,94,0.5)] border-emerald-500/50 bg-[linear-gradient(90deg,#16a34a,#22c55e,#10b981)] w-full min-w-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.471-.148-.67.149-.198.297-.768.966-.941 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.205-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.521.074-.793.372s-1.042 1.016-1.042 2.479 1.067 2.876 1.219 3.074c.149.198 2.1 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.718 2.007-1.41.248-.694.248-1.289.173-1.41-.074-.123-.272-.198-.57-.347m-5.49 7.485h-.004a9.867 9.867 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.861 9.861 0 01-1.51-5.241c.001-5.45 4.434-9.884 9.885-9.884 2.641 0 5.122 1.03 6.988 2.897a9.825 9.825 0 012.897 6.994c-.003 5.45-4.436 9.884-9.887 9.884m8.413-18.297A11.815 11.815 0 0012.004 0C5.375 0 .16 5.215.157 11.844a11.82 11.82 0 001.624 5.99L0 24l6.305-1.654a11.86 11.86 0 005.68 1.448h.005c6.628 0 11.843-5.215 11.846-11.844a11.787 11.787 0 00-3.473-8.372z"/></svg>
                <span className="whitespace-nowrap">WhatsApp</span>
              </button>
              <button onClick={shareResultDirect} className="col-span-1 inline-flex items-center justify-center gap-2 h-12 px-3 rounded-lg text-sm font-extrabold border text-white shadow-[0_8px_18px_rgba(139,92,246,0.4)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.55)] border-violet-500/40 bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)] w-full min-w-0">
                <Share2 className="w-5 h-5" aria-hidden="true" />
                <span className="truncate">Share</span>
              </button>
            </div>
          </div>
        </div>
      {/* No ShareSheet dialog — direct device share used */}
    </div>
  );
};

export default Results;