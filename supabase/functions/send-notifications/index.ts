// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Defer web-push import to request time to avoid startup errors on preflight
let webpush: any | null = null;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("VITE_VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || Deno.env.get("VITE_VAPID_PRIVATE_KEY");
// Support both CONTACT_EMAIL and legacy VAPID_CONTACT_EMAIL env names
const VAPID_CONTACT =
  Deno.env.get("CONTACT_EMAIL") ||
  Deno.env.get("VAPID_CONTACT_EMAIL") ||
  "mailto:notify@example.com"; // configure in project settings

const HAS_VAPID = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (!HAS_VAPID) {
  console.warn("VAPID keys are not set in environment variables. Push delivery will be skipped.");
}

// CORS: support multiple origins (comma-separated). Default to production.
const DEFAULT_ORIGINS = "https://quizdangal.com,http://localhost:5173,http://localhost:5174";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS")
  || Deno.env.get("ALLOWED_ORIGIN")
  || DEFAULT_ORIGINS)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function makeCorsHeaders(req: Request): Record<string, string> {
  const reqOrigin = req.headers.get("Origin") || "";
  const isLocal = reqOrigin.startsWith("http://localhost");
  const isAllowed = ALLOWED_ORIGINS.includes("*")
    || ALLOWED_ORIGINS.includes(reqOrigin)
    || (isLocal && ALLOWED_ORIGINS.some((o) => o.startsWith("http://localhost")));
  const allowOrigin = isAllowed ? reqOrigin : (ALLOWED_ORIGINS[0] || "https://quizdangal.com");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    // Allow GET so clients can retrieve public config like VAPID key
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

serve(async (req) => {
  // Handle CORS preflight FIRST, before any try-catch
  if (req.method === 'OPTIONS') {
    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") || "https://quizdangal.com",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      // Mirror allowed methods here
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Vary": "Origin",
    };
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Public GET endpoint to expose non-sensitive config (e.g., VAPID public key)
  if (req.method === 'GET') {
    const body = {
      vapidPublicKey: VAPID_PUBLIC_KEY || '',
      allowedOrigins: ALLOWED_ORIGINS,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(req) },
    });
  }
  
  try {
    // Only POST is allowed beyond this point
    if (req.method !== 'POST') {
      return new Response("Method Not Allowed", { status: 405, headers: { ...makeCorsHeaders(req) } });
    }
    const { message, title, type, url, segment, quizId, mode } = await req.json();

    const missingCoreConfig: string[] = [];
    if (!SUPABASE_URL) missingCoreConfig.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE) missingCoreConfig.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!HAS_VAPID) missingCoreConfig.push('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY');
    if (!SUPABASE_ANON_KEY && mode !== 'cron') missingCoreConfig.push('SUPABASE_ANON_KEY');

    if (missingCoreConfig.length > 0) {
      const detail = `Missing required environment variables: ${missingCoreConfig.join(', ')}`;
      console.error(detail);
      const status = missingCoreConfig.includes('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY') ? 503 : 500;
      return new Response(
        JSON.stringify({ error: detail }),
        { status, headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(req) } }
      );
    }

    // Two modes:
    //  - user: default; requires Authorization of an admin user
    //  - cron: requires X-Cron-Secret header matching env CRON_SECRET; skips user admin check
    const cronSecretHeader = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret');
    const isCronMode = mode === 'cron' && CRON_SECRET && cronSecretHeader && cronSecretHeader === CRON_SECRET;

    let user: { id: string } | null = null;
    if (!isCronMode) {
      // Authenticate caller and ensure they are admin
      const authHeader = req.headers.get('Authorization');
      const supabaseUserClient = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: authHeader ?? '' } } }
      );
      const userResp = await supabaseUserClient.auth.getUser();
      const userErr = userResp.error; user = userResp.data?.user || null;
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(req) } });
      }
    }

    if (!message || !title) {
      return new Response(
        JSON.stringify({ error: "Message and title are required." }),
        { status: 400, headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) } }
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE
    );

    // Verify admin role from profiles table
    if (!isCronMode) {
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single();
      if (profErr || !profile || profile.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...makeCorsHeaders(req) } });
      }
    }

    // Determine audience based on optional segment value.
    // Supported:
    //  - undefined or 'all' => broadcast to all subscribers
    //  - 'participants:<quiz_uuid>' => only users who joined that quiz
    let subscriptions: Array<{ subscription_object: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
    let error: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

    const seg = typeof segment === 'string' ? segment.trim() : '';
    const segMatch = /^participants\s*:\s*([0-9a-fA-F-]{36})$/.exec(seg || '');

    if (segMatch) {
      const segQuizId = segMatch[1];
      // Efficiently fetch subscriptions via view join
      const { data, error: qerr } = await supabaseAdmin
        .from('v_quiz_subscriptions')
        .select('subscription_object')
        .eq('quiz_id', segQuizId);
      subscriptions = (data || []) as any;
      error = qerr;
    } else {
      const { data, error: berr } = await supabaseAdmin
        .from('push_subscriptions')
        .select('subscription_object');
      subscriptions = data || [];
      error = berr;
    }

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) } });
    }

    const payloadQuizId = typeof quizId === 'string' ? quizId : (segMatch ? segMatch[1] : undefined);
    // Derive URL if missing and quizId exists
    let finalUrl = typeof url === 'string' ? url : undefined;
    if (!finalUrl && payloadQuizId) {
      if (type === 'start_soon') finalUrl = `/quiz/${payloadQuizId}`;
      else if (type === 'result') finalUrl = `/results/${payloadQuizId}`;
    }

    const notificationPayload = JSON.stringify({
      title: title,
      body: message,
      icon: "/android-chrome-192x192.png",
      type: typeof type === 'string' ? type : undefined,
      url: finalUrl,
      quizId: payloadQuizId,
    });

    // Dynamically import and configure web-push only when needed
    if (HAS_VAPID && !webpush) {
      const mod = await import("https://esm.sh/web-push@3.6.7?target=deno");
      webpush = mod.default || mod;
      webpush.setVapidDetails(
        VAPID_CONTACT,
        VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY!
      );
    }

    const sendPromises = subscriptions.map(async (sub) => {
          const endpoint = sub?.subscription_object?.endpoint as string | undefined;
          try {
            await webpush.sendNotification(sub.subscription_object, notificationPayload);
          } catch (err: any) {
            const status = err?.statusCode;
            const msg = err?.message || String(err);
            console.error(`Failed to send notification${endpoint ? ` to ${endpoint}` : ''}. Status: ${status}. Error: ${msg}`);
            // Clean up expired/invalid subscriptions. Common "gone" codes: 404, 410
            if ((status === 404 || status === 410) && endpoint) {
              console.log(`Cleaning up expired subscription for endpoint: ${endpoint}`);
              // Delete by generated column 'endpoint' (unique-keyed with user_id) for reliable match
              const { error: delErr } = await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', endpoint);
              if (delErr) {
                console.error(`Failed to delete expired subscription for ${endpoint}:`, delErr.message);
              }
            }
          }
        });

    await Promise.all(sendPromises);

    // Log this broadcast once for admin activity view
    // Log this push once for admin activity view (label by mode)
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          title: title,
          message: message,
          type: isCronMode ? (typeof type === 'string' ? type : 'auto_push') : 'broadcast_push',
          segment: typeof segment === 'string' ? segment : null,
          created_by: isCronMode ? null : user?.id ?? null,
        });
    } catch (logErr) {
      console.error('Failed to log push:', logErr);
    }

    return new Response(JSON.stringify({ message: "Notifications sent successfully." }), { status: 200, headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) } });
  } catch (e: any) {
    console.error("Main error:", e);
    try {
      return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) } });
    } catch (corsErr) {
      // Fallback if even CORS headers fail
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  }
});