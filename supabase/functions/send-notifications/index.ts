import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("VAPID keys are not set in environment variables.");
}

webpush.setVapidDetails(
  "mailto:your-email@example.com", // Replace with your email
  VAPID_PUBLIC_KEY!,
  VAPID_PRIVATE_KEY!
);

serve(async (req) => {
  try {
    const { message, title } = await req.json();

    if (!message || !title) {
      return new Response(
        JSON.stringify({ error: "Message and title are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription_object");

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notificationPayload = JSON.stringify({
      title: title,
      body: message,
      icon: "/android-chrome-192x192.png",
    });

    const sendPromises = subscriptions.map((sub) =>
      webpush.sendNotification(sub.subscription_object, notificationPayload)
        .catch(err => {
          console.error(`Failed to send notification to endpoint: ${sub.subscription_object.endpoint}. Error: ${err.message}`);
          // Here you might want to handle expired subscriptions, e.g., by deleting them from the database
          if (err.statusCode === 410) {
             console.log(`Subscription expired for endpoint: ${sub.subscription_object.endpoint}. Deleting.`);
             return supabaseAdmin.from('push_subscriptions').delete().eq('subscription_object', sub.subscription_object);
          }
        })
    );

    await Promise.all(sendPromises);

    return new Response(
      JSON.stringify({ message: "Notifications sent successfully." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Main error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});