// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
// Support both CONTACT_EMAIL and legacy VAPID_CONTACT_EMAIL env names
const VAPID_CONTACT =
  Deno.env.get("CONTACT_EMAIL") ||
  Deno.env.get("VAPID_CONTACT_EMAIL") ||
  "mailto:notify@example.com"; // configure in project settings

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("VAPID keys are not set in environment variables.");
}

webpush.setVapidDetails(
  VAPID_CONTACT,
  VAPID_PUBLIC_KEY!,
  VAPID_PRIVATE_KEY!
);

// Restrict CORS to configured origin (default to production domain)
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://quizdangal.com";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    // Preflight
    return new Response("", { status: 204, headers: { ...corsHeaders } });
  }
  try {
    const { message, title } = await req.json();

    // Authenticate caller and ensure they are admin
    const authHeader = req.headers.get('Authorization');
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? '' } } }
    );
    const { data: { user }, error: userErr } = await supabaseUserClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!message || !title) {
      return new Response(
        JSON.stringify({ error: "Message and title are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      // Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE
      (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE") || "")
    );

    // Verify admin role from profiles table
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profErr || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription_object");

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const notificationPayload = JSON.stringify({
      title: title,
      body: message,
      icon: "/android-chrome-192x192.png",
    });

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

    return new Response(
      JSON.stringify({ message: "Notifications sent successfully." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (e: any) {
    console.error("Main error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});