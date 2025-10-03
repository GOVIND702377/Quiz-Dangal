// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_CONTACT = Deno.env.get("CONTACT_EMAIL") || Deno.env.get("VAPID_CONTACT_EMAIL") || "mailto:notify@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE") || "";

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

// CORS allow only server-to-server; this function is intended to be invoked by cron only.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders });

  // This function is meant to be triggered by a scheduler/cron using service key via Secret Header
  const authHeader = req.headers.get('x-service-key');
  if (!authHeader || authHeader !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Send "starting soon" notifications for quizzes starting within 1 minute and not already sent
  const now = new Date();
  const inOneMin = new Date(now.getTime() + 60 * 1000);

  // Fetch quizzes starting within next minute and status upcoming
  const { data: startingQuizzes, error: startErr } = await admin
    .from('quizzes')
    .select('id, title, start_time')
    .eq('status', 'upcoming')
    .gte('start_time', now.toISOString())
    .lte('start_time', inOneMin.toISOString());

  if (startErr) {
    console.error('Fetch starting quizzes error', startErr)
  }

  // 2) Send result notifications for quizzes where end_time <= now AND results exist (no longer using result_time)
  const { data: endedQuizzes, error: resErr } = await admin
    .from('quizzes')
    .select('id, title, end_time, status')
    .lte('end_time', now.toISOString())
    .in('status', ['active','finished']);

  if (resErr) {
    console.error('Fetch result quizzes error', resErr)
  }

  // Utility: check & mark sent in quiz_notification_log
  const markAndSend = async (
    quizId: string,
    type: 'start_soon' | 'result',
    title: string,
    body: string,
    personalized?: boolean
  ) => {
    const { data: already, error: chkErr } = await admin
      .from('quiz_notification_log')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('type', type)
      .limit(1);
    if (chkErr) {
      console.error('Check log error', chkErr);
      return;
    }
    if (already && already.length > 0) return; // already sent

    // Get participants subscriptions
    const { data: subs, error: sErr } = await admin
      .from('push_subscriptions')
      .select('subscription_object, endpoint, user_id')
      .in('user_id', (
        (await admin.from('quiz_participants').select('user_id').eq('quiz_id', quizId)).data?.map(r => r.user_id) || []
      ));
    if (sErr) {
      console.error('Fetch subs error', sErr);
      return;
    }

    // Include type, quizId, and deep-link url so SW can handle replacement/closing
    const url = type === 'result' ? `/#/results/${quizId}` : `/#/quiz/${quizId}`;

    if (personalized && type === 'result') {
      // Build leaderboard map and prize mapping for per-user messages
      const [{ data: qrow }, { data: resRow }] = await Promise.all([
        admin.from('quizzes').select('id, title, prize_type, prizes').eq('id', quizId).single(),
        admin.from('quiz_results').select('leaderboard').eq('quiz_id', quizId).single()
      ]);

      const leaderboard: Array<{ user_id: string; rank?: number; rk?: number }> = Array.isArray(resRow?.leaderboard) ? resRow!.leaderboard as any : [];
      const rankByUser = new Map<string, number>();
      for (const e of leaderboard) {
        const u = (e as any).user_id as string | undefined;
        const rk = (e as any).rank ?? (e as any).rk;
        if (u && typeof rk === 'number') rankByUser.set(u, rk);
      }

      // Fetch normalized prizes; fallback to quizzes.prizes
      const { data: prizeRows } = await admin
        .from('quiz_prizes')
        .select('rank_from, rank_to, prize_coins')
        .eq('quiz_id', quizId);

      const prizeRanges: Array<{ from: number; to: number; amt: number }> = [];
      if (Array.isArray(prizeRows) && prizeRows.length > 0) {
        for (const pr of prizeRows) {
          const from = Number(pr.rank_from);
          const to = Number(pr.rank_to);
          const amt = Number(pr.prize_coins || 0);
          if (from >= 1 && to >= from && amt >= 0) prizeRanges.push({ from, to, amt });
        }
      } else if (Array.isArray(qrow?.prizes)) {
        const arr: any[] = qrow!.prizes as any;
        for (let i = 0; i < arr.length; i++) {
          const n = Number(arr[i]);
          if (!Number.isNaN(n)) prizeRanges.push({ from: i + 1, to: i + 1, amt: n });
        }
      }

      const unit = qrow?.prize_type === 'coins' ? 'coins' : '';
      const safeTitle = 'Quiz Result';

      await Promise.all((subs || []).map(async (s) => {
        try {
          const uid = s.user_id as string | undefined;
          const rk = uid ? rankByUser.get(uid) : undefined;
          let prizeText = '';
          if (typeof rk === 'number') {
            let amt: number | undefined = undefined;
            for (const r of prizeRanges) {
              if (rk >= r.from && rk <= r.to) { amt = r.amt; break; }
            }
            if (typeof amt === 'number' && amt > 0) {
              prizeText = unit ? ` • Prize: ${amt} ${unit}` : ` • Prize: ${amt}`;
            }
          }
          const bodyPerUser = `${qrow?.title || 'Quiz'} ka result aa chuka hai. Aapka rank${typeof rk === 'number' ? ` #${rk}` : ''}${prizeText}. Leaderboard dekhiye!`;
          const payload = JSON.stringify({
            title: safeTitle,
            body: bodyPerUser,
            icon: '/android-chrome-192x192.png',
            type,
            quizId: quizId,
            url,
          });
          await webpush.sendNotification(s.subscription_object, payload);
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          } else {
            console.error('push send error', err);
          }
        }
      }));
    } else {
      const payload = JSON.stringify({
        title,
        body,
        icon: '/android-chrome-192x192.png',
        type,
        quizId,
        url,
      });

      await Promise.all((subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription_object, payload);
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          } else {
            console.error('push send error', err);
          }
        }
      }));
    }

    // Mark sent
    await admin.from('quiz_notification_log').insert({ quiz_id: quizId, type, sent_at: new Date().toISOString() });
  };

  // Process start soon
  for (const q of startingQuizzes || []) {
    // Requested Hindi copy to create urgency; sent ~1 minute before start
    const body = `🔥 Time’s up! Quiz arena खुलने वाला है 🎯 अबकी बार जीतकर दिखाओ — चलो, अभी join करो!\n⏳ 1 मिनट में शुरू हो रहा है`;
    await markAndSend(q.id, 'start_soon', q.title || 'Quiz Reminder', body);
  }

  // Process result published: only if quiz_results exist for the quiz
  let resultCount = 0;
  for (const q of endedQuizzes || []) {
    const { data: anyRes, error: rErr } = await admin
      .from('quiz_results')
      .select('id')
      .eq('quiz_id', q.id)
      .limit(1);
    if (rErr) {
      console.error('Check quiz_results error', rErr);
      continue;
    }
    if (anyRes && anyRes.length > 0) {
      // Personalized result notifications: include rank/prize per user
      await markAndSend(q.id, 'result', 'Quiz Result', '', true);
      resultCount++;
    }
  }

  return new Response(JSON.stringify({ ok: true, startCount: startingQuizzes?.length || 0, resultCount }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
