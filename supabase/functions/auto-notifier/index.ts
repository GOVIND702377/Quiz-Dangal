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

  // 2) Send result notifications for quizzes where result_time <= now and not already sent
  const { data: resultQuizzes, error: resErr } = await admin
    .from('quizzes')
    .select('id, title, result_time')
    .lte('result_time', now.toISOString())
    .in('status', ['active','finished']);

  if (resErr) {
    console.error('Fetch result quizzes error', resErr)
  }

  // Utility: check & mark sent in quiz_notification_log
  const markAndSend = async (quizId: string, type: 'start_soon' | 'result', title: string, body: string) => {
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

    const payload = JSON.stringify({ title, body, icon: '/android-chrome-192x192.png' });

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

    // Mark sent
    await admin.from('quiz_notification_log').insert({ quiz_id: quizId, type, sent_at: new Date().toISOString() });
  };

  // Process start soon
  for (const q of startingQuizzes || []) {
    const body = `${q.title} 1 minute mein start hone wala hai. Tayyar ho jao!`;
    await markAndSend(q.id, 'start_soon', 'Quiz Reminder', body);
  }

  // Process result published
  for (const q of resultQuizzes || []) {
    const body = `${q.title} ka result aa chuka hai. Leaderboard dekhien!`;
    await markAndSend(q.id, 'result', 'Quiz Result', body);
  }

  return new Response(JSON.stringify({ ok: true, startCount: startingQuizzes?.length || 0, resultCount: resultQuizzes?.length || 0 }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
