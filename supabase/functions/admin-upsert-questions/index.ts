// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OptionPayload = {
  option_text: string;
  is_correct?: boolean;
};

type QuestionPayload = {
  question_text: string;
  options: OptionPayload[];
};

type RequestBody = {
  quizId?: string;
  items?: QuestionPayload[];
  mode?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SUPABASE_SERVICE_ROLE")
  ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? "";

const DEFAULT_ORIGINS = "https://quizdangal.com,http://localhost:5173,http://localhost:5174";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS")
  ?? Deno.env.get("ALLOWED_ORIGIN")
  ?? DEFAULT_ORIGINS)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isLocal = origin.startsWith("http://localhost");
  const allowOrigin = (ALLOWED_ORIGINS.includes("*")
    || ALLOWED_ORIGINS.includes(origin)
    || (isLocal && ALLOWED_ORIGINS.some((value) => value.startsWith("http://localhost"))))
    ? origin
    : (ALLOWED_ORIGINS[0] ?? "https://quizdangal.com");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function isUuid(value: string | undefined): boolean {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function sanitizeItems(rawItems: QuestionPayload[] | undefined): QuestionPayload[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => {
      const question = String(item?.question_text ?? "").trim();
      const options = Array.isArray(item?.options) ? item.options : [];
      const cleanedOptions = options
        .map((option) => ({
          option_text: String(option?.option_text ?? "").trim(),
          is_correct: Boolean(option?.is_correct),
        }))
        .filter((option) => option.option_text !== "");
      return {
        question_text: question,
        options: cleanedOptions,
      };
    })
    .filter((item) => item.question_text.length > 0 && item.options.length >= 2);
}

async function ensureAdmin(headers: Headers) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return { ok: false as const, status: 500, reason: "Supabase client not configured" };
  }
  const authHeader = headers.get("Authorization") ?? "";
  if (!authHeader) {
    return { ok: false as const, status: 401, reason: "Missing Authorization header" };
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user) {
    return { ok: false as const, status: 401, reason: "Unauthorized" };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { ok: false as const, status: 500, reason: "Service role not configured" };
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userResp.user.id)
    .single();

  if (profileErr || profile?.role !== "admin") {
    return { ok: false as const, status: 403, reason: "Forbidden" };
  }

  return { ok: true as const, userId: userResp.user.id, adminClient };
}

async function runRpcOrFallback(adminClient: ReturnType<typeof createClient>, quizId: string, items: QuestionPayload[], mode: string) {
  const payload = items.map((item) => ({
    question_text: item.question_text,
    options: item.options.map((option, index) => ({
      option_text: option.option_text,
      is_correct: Boolean(option.is_correct) && index < 4,
    })).slice(0, 4),
  }));

  try {
    const { error } = await adminClient.rpc("admin_bulk_upsert_questions", {
      p_quiz_id: quizId,
      p_payload: payload,
      p_mode: mode,
    });
    if (!error) {
      return { ok: true as const, usedFallback: false as const };
    }
    console.warn("admin_bulk_upsert_questions RPC failed, falling back", error.message);
  } catch (rpcError) {
    console.warn("admin_bulk_upsert_questions threw, falling back", rpcError);
  }

  if (mode === "replace") {
    const { error: deleteErr } = await adminClient
      .from("questions")
      .delete()
      .eq("quiz_id", quizId);
    if (deleteErr) {
      return { ok: false as const, reason: deleteErr.message };
    }
  }

  for (const item of payload) {
    const { data: questionRow, error: questionErr } = await adminClient
      .from("questions")
      .insert({ quiz_id: quizId, question_text: item.question_text })
      .select("id")
      .single();
    if (questionErr || !questionRow) {
      return { ok: false as const, reason: questionErr?.message ?? "Question insert failed" };
    }

    const optionRows = item.options.slice(0, 4).map((option) => ({
      question_id: questionRow.id,
      option_text: option.option_text,
      is_correct: Boolean(option.is_correct),
    }));

    if (!optionRows.length) {
      continue;
    }

    const { error: optionErr } = await adminClient
      .from("options")
      .insert(optionRows);
    if (optionErr) {
      return { ok: false as const, reason: optionErr.message };
    }
  }

  return { ok: true as const, usedFallback: true as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: { ...makeCorsHeaders(req) } });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...makeCorsHeaders(req) },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "append";
    const items = sanitizeItems(body.items);

    if (!isUuid(quizId)) {
      return new Response(JSON.stringify({ error: "Invalid quizId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
      });
    }

    if (!items.length) {
      return new Response(JSON.stringify({ error: "No questions supplied" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
      });
    }

    if (mode !== "append" && mode !== "replace") {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
      });
    }

    const adminCheck = await ensureAdmin(req.headers);
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.reason }), {
        status: adminCheck.status,
        headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
      });
    }

    const result = await runRpcOrFallback(adminCheck.adminClient, quizId, items, mode);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.reason ?? "Insert failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
      });
    }

    return new Response(JSON.stringify({ ok: true, fallback: result.usedFallback ?? false }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
    });
  } catch (error) {
    console.error("admin-upsert-questions error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...makeCorsHeaders(req) },
    });
  }
});
