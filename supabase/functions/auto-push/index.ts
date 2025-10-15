// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";

async function callSendNotifications(payload: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/functions/v1/send-notifications`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': CRON_SECRET,
      // Pass platform JWT verification by including anon key
      ...(SUPABASE_ANON_KEY ? { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } : {}),
    },
    body: JSON.stringify({ ...payload, mode: 'cron' }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`send-notifications error ${res.status}: ${txt}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
      }
    });
  }
  
  try {
    const missingConfig: string[] = [];
    if (!SUPABASE_URL) missingConfig.push('SUPABASE_URL');
    if (!SERVICE_ROLE) missingConfig.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_ANON_KEY) missingConfig.push('SUPABASE_ANON_KEY');
    if (missingConfig.length) {
      const detail = `Missing required environment variables: ${missingConfig.join(', ')}`;
      console.error(detail);
      return new Response(
        JSON.stringify({ error: detail }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional protection: require CRON_SECRET on public call to avoid accidental manual trigger
    const headerSecret = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret') || '';
    if (CRON_SECRET) {
      if (!headerSecret || headerSecret !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Start-soon pushes (within next 1 minute)
    const startDue = await admin.from('v_start_soon_due').select('quiz_id, title');
    if (startDue.error) throw startDue.error;
    let startCount = 0;
    for (const row of (startDue.data || [])) {
      const quizId = row.quiz_id;
      const markedAt = new Date().toISOString();
      const { error: markError } = await admin
        .from('quizzes')
        .update({ start_push_sent_at: markedAt })
        .eq('id', quizId);
      if (markError) {
        throw new Error(`Failed to mark start push for quiz ${quizId}: ${markError.message || markError}`);
      }
      try {
        await callSendNotifications({
          title: `${row.title || 'Quiz'} starts soon`,
          message: 'Get ready! Starting in 1 minute.',
          type: 'start_soon',
          segment: `participants:${quizId}`,
          quizId,
        });
        startCount += 1;
      } catch (notifyErr) {
        console.error(`Failed to send start push for quiz ${quizId}:`, notifyErr);
        const { error: revertError } = await admin
          .from('quizzes')
          .update({ start_push_sent_at: null })
          .eq('id', quizId);
        if (revertError) {
          console.error(`Failed to revert start push timestamp for quiz ${quizId}:`, revertError);
        }
        throw notifyErr;
      }
    }

    // Result pushes (once visible)
    const resDue = await admin.from('v_result_push_due').select('quiz_id');
    if (resDue.error) throw resDue.error;
    let resultCount = 0;
    for (const row of (resDue.data || [])) {
      const quizId = row.quiz_id;
      const markedAt = new Date().toISOString();
      const { error: markError } = await admin
        .from('quiz_results')
        .update({ result_push_sent_at: markedAt })
        .eq('quiz_id', quizId);
      if (markError) {
        throw new Error(`Failed to mark result push for quiz ${quizId}: ${markError.message || markError}`);
      }
      try {
        await callSendNotifications({
          title: 'Quiz Result',
          message: 'Results are out. Check your rank!',
          type: 'result',
          segment: `participants:${quizId}`,
          quizId,
        });
        resultCount += 1;
      } catch (notifyErr) {
        console.error(`Failed to send result push for quiz ${quizId}:`, notifyErr);
        const { error: revertError } = await admin
          .from('quiz_results')
          .update({ result_push_sent_at: null })
          .eq('quiz_id', quizId);
        if (revertError) {
          console.error(`Failed to revert result push timestamp for quiz ${quizId}:`, revertError);
        }
        throw notifyErr;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, startCount, resultCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('auto-push error:', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
