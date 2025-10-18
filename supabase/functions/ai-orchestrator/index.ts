// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
// AI Orchestrator Edge Function
// redeploy-bump: config sync
// Schedules and generates quizzes backend-only with provider failover and alerting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SUPABASE_SERVICE_ROLE")
  ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Simple email sender via PostgREST RPC or SMTP webhook
async function sendAlert(supabase: any, emails: string[], subject: string, body: string) {
  try {
    if (!emails?.length) return;
    await supabase.from('ai_generation_logs').insert({ level: 'warn', message: `ALERT: ${subject}`, context: { emails, body } });
    // Try an optional email RPC if present in your DB
    try {
      await supabase.rpc('admin_send_email', { p_to: emails, p_subject: subject, p_text: body });
    } catch (_) { /* ignore if RPC doesn't exist */ }

    // Fallback: use Resend API directly if configured
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'alerts@no-reply.local';
      if (RESEND_API_KEY) {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: RESEND_FROM, to: emails, subject, text: body }),
        });
        // log non-2xx responses for visibility
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          await supabase.from('ai_generation_logs').insert({ level: 'error', message: 'Resend email failed', context: { status: resp.status, text } });
        }
      }
    } catch (_) { /* ignore email fallback errors */ }
  } catch (_) { /* noop */ }
}

// Provider invocation wrappers (extensible)
async function callProvider(name: string, apiKey: string, prompt: string): Promise<{ title: string; items: { question_text: string; options: { option_text: string; is_correct: boolean }[] }[] } | null> {
  const provider = String(name || '').toLowerCase();
  if (!apiKey) return null;

  // Common system message to enforce strict JSON
  const system = `You are a strict JSON generator. Respond ONLY with valid minified JSON matching this schema:
  { "title": string, "items": [ { "question_text": string, "options": [ { "option_text": string, "is_correct": boolean }, {..}, {..}, {..} ] }, ... (10 items total) ] }
  No markdown, no code fences, no commentary.`;

  try {
    if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          temperature: 0.6,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content);
    }

    if (provider === 'groq') {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt + '\nRespond with JSON only.' },
          ],
          temperature: 0.6,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      // Some models may wrap in ```json fences—strip if present
      const cleaned = String(content).trim().replace(/^```json\n?|```$/g, '');
      return JSON.parse(cleaned);
    }

    if (provider === 'anthropic' || provider === 'claude' || provider === 'anthropic-claude') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          system,
          messages: [ { role: 'user', content: prompt + '\nOutput JSON only.' } ],
          max_tokens: 2000,
          temperature: 0.6,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const content = data?.content?.[0]?.text || data?.content?.[0]?.["text"] || '';
      if (!content) return null;
      const cleaned = String(content).trim().replace(/^```json\n?|```$/g, '');
      return JSON.parse(cleaned);
    }
  } catch (_) {
    return null;
  }
  return null;
}

function roundToMinute(d = new Date()) {
  d.setSeconds(0, 0);
  return d;
}

function alignToCadence(d = new Date(), cadenceMin = 10) {
  const dt = new Date(d);
  dt.setSeconds(0, 0);
  const m = dt.getMinutes();
  const aligned = m - (m % Math.max(1, cadenceMin));
  dt.setMinutes(aligned);
  return dt;
}

function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonHeaders(req: Request): HeadersInit {
  return { "Content-Type": "application/json", ...makeCorsHeaders(req) };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: { ...makeCorsHeaders(req) } });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Server not configured", { status: 500, headers: { ...makeCorsHeaders(req) } });
  }

  // Require cron secret for non-OPTIONS requests
  const cronHeader = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret') || '';
  if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
    return new Response("Forbidden", { status: 403, headers: { ...makeCorsHeaders(req) } });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
      // Optional task override via query param: ?task=cleanup
      const url = new URL(req.url);
      const task = url.searchParams.get('task') || 'run';

      // Load settings
      const { data: settingsRow, error: sErr } = await supabase.from('ai_settings').select('*').eq('id', 1).maybeSingle();
      if (sErr) throw sErr;
      const settings = settingsRow || { is_enabled: false };

      if (task === 'cleanup') {
        const days = Number(settings.cleanup_days || 3);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        // Collect AI quiz IDs that ended before cutoff
        const { data: oldQuizzes, error: qErr } = await supabase
          .from('quizzes')
          .select('id')
          .lte('end_time', cutoff)
          .eq('is_ai_generated', true);
        if (qErr) throw qErr;
        const ids = (oldQuizzes || []).map((r: any) => r.id);
        if (!ids.length) {
          await supabase.from('ai_generation_logs').insert({ level: 'info', message: `cleanup skip (none)` , context: { cutoff } });
          return new Response(JSON.stringify({ ok: true, task: 'cleanup', count: 0 }), { headers: jsonHeaders(req) });
        }

        // Delete dependent data explicitly to avoid FK violations in strict schemas
        // user_answers for those quizzes' questions
        const { data: qs } = await supabase.from('questions').select('id').in('quiz_id', ids).limit(100000);
        const qids = (qs || []).map((x: any) => x.id);
        if (qids.length) {
          await supabase.from('user_answers').delete().in('question_id', qids);
          await supabase.from('options').delete().in('question_id', qids);
          await supabase.from('questions').delete().in('id', qids);
        }

        // participants and results
        await supabase.from('quiz_participants').delete().in('quiz_id', ids);
        await supabase.from('quiz_results').delete().in('quiz_id', ids);

        // finally quizzes
        const { error: delErr } = await supabase.from('quizzes').delete().in('id', ids);
        if (delErr) throw delErr;
        await supabase.from('ai_generation_logs').insert({ level: 'info', message: `cleanup done`, context: { cutoff, count: ids.length } });
        return new Response(JSON.stringify({ ok: true, task: 'cleanup', count: ids.length }), { headers: jsonHeaders(req) });
      }
    if (!settings.is_enabled) {
      return new Response(JSON.stringify({ ok: true, message: 'disabled' }), { headers: jsonHeaders(req) });
    }

  const now = new Date();
  const cadence = Number(settings.cadence_min || 10);
  const liveMin = Number(settings.live_window_min || 7);
  const slotStart = alignToCadence(now, cadence);
  const nextSlotStart = new Date(slotStart.getTime() + cadence * 60_000);

  // Warn if cadence != liveMin + 3 (desired 7-min live, 3-min gap)
  if (cadence !== liveMin + 3) {
    await supabase.from('ai_generation_logs').insert({ level: 'warn', message: 'cadence and live_window_min mismatch', context: { cadence_min: cadence, live_window_min: liveMin, expected_gap: 3 } });
  }

  const categories: string[] = settings.categories || [];

  for (const category of categories) {
    const slots = [
      { start: slotStart, end: new Date(slotStart.getTime() + liveMin * 60_000) },
      { start: nextSlotStart, end: new Date(nextSlotStart.getTime() + liveMin * 60_000) },
    ];

    for (const s of slots) {
      // Insert or get existing job for each slot
      let job: any = null;
      try {
        const iresp = await supabase
          .from('ai_generation_jobs')
          .insert({ category, slot_start: s.start.toISOString(), slot_end: s.end.toISOString(), status: 'queued' })
          .select('*')
          .single();
        job = iresp.data;
      } catch (_e) {
        const gresp = await supabase
          .from('ai_generation_jobs')
          .select('*')
          .eq('category', category)
          .eq('slot_start', s.start.toISOString())
          .maybeSingle();
        job = gresp.data;
      }

      if (!job) continue;
      if (job.status !== 'queued') continue; // idempotent if running/completed/failed

      // Atomically claim job to avoid duplicate processing across concurrent invocations
      const claim = await supabase
        .from('ai_generation_jobs')
        .update({ status: 'running' })
        .eq('id', job.id)
        .eq('status', 'queued')
        .select('id')
        .maybeSingle();
      if (!claim.data) {
        // Someone else claimed this job
        continue;
      }

      // Provider selection: enabled, not quota_exhausted, lowest priority, then id
      const { data: providers } = await supabase
        .from('ai_providers')
        .select('*')
        .eq('enabled', true)
        .eq('quota_exhausted', false)
        .order('priority', { ascending: true })
        .order('id', { ascending: true });

      let success = false;
      let lastErr: string | null = null;

      // Hindi + English prompt with constraints and difficulty mix
      const prompt = [
        `You are a Quiz Generator. Create exactly 10 multiple-choice questions for the category: ${category}.`,
        `Each question MUST be bilingual: Hindi main text + (English translation in brackets).`,
        `Title: unique, catchy, and clearly related to the category, also bilingual (Hindi + (English)).`,
        `Options: exactly 4 per question. Keep options concise (not too short, not too long).`,
        `Difficulty mix across the 10 questions: 40% easy, 30% medium, 30% hard (label not needed, just ensure balance).`,
        `Opinion category should be fun, engaging, and can ask lighthearted or trending preferences (no correct answer; set all options is_correct=false).`,
        `For non-opinion categories (sports, gk, movies): ensure factual correctness.`,
        `Prefer trending topics when reasonable (news, recent releases, viral subjects).`,
        `Return STRICT JSON with this shape: { title: string, items: Array<{ question_text: string, options: Array<{ option_text: string, is_correct: boolean }> }> }`,
        `Make sure there are exactly 10 items and exactly 4 options in each item.`
      ].join('\n');

      for (const p of providers || []) {
        const apiKey = p.api_key_enc || '';
        try {
          const payload = await callProvider(p.name, apiKey, prompt);
          if (!payload) throw new Error('provider returned no data');

          // Normalize and validate payload strictly
          const rawItems = Array.isArray(payload.items) ? payload.items : [];
          if (rawItems.length !== 10) throw new Error('invalid item count (need exactly 10)');
          const normalized = rawItems.map((it: any) => ({
            question_text: String(it?.question_text ?? '').trim(),
            options: (Array.isArray(it?.options) ? it.options : []).map((op: any) => ({
              option_text: String(op?.option_text ?? '').trim(),
              is_correct: !!op?.is_correct,
            })),
          }));
          // Exactly 4 options per question
          if (!normalized.every((q: any) => Array.isArray(q.options) && q.options.length === 4 && q.question_text.length > 0 && q.options.every((o: any) => o.option_text.length > 0))) {
            throw new Error('invalid options shape (need exactly 4 options with non-empty text)');
          }

          const isOpinion = String(category).toLowerCase() === 'opinion';
          let finalItems = normalized;
          if (isOpinion) {
            // Force no-correct for opinion quizzes
            finalItems = finalItems.map((q: any) => ({
              question_text: q.question_text,
              options: q.options.map((o: any) => ({ option_text: o.option_text, is_correct: false })),
            }));
          } else {
            // Non-opinion must have exactly one correct per question
            const ok = finalItems.every((q: any) => q.options.filter((o: any) => o.is_correct === true).length === 1);
            if (!ok) throw new Error('each question must have exactly one correct option');
          }

          // Create quiz row
          const title = (payload.title && String(payload.title).trim()) || `${category.toUpperCase()} Quiz (Bilingual)`;
          const { data: quiz, error: qErr } = await supabase
            .from('quizzes')
            .insert({
              title,
              category,
              prize_type: 'coins',
              prizes: [101, 71, 51],
              prize_pool: 101 + 71 + 51,
              start_time: s.start.toISOString(),
              end_time: s.end.toISOString(),
              is_ai_generated: true,
            })
            .select('*')
            .single();
          if (qErr) throw qErr;

          // Upsert questions via RPC (admin path)
          const { error: rpcErr } = await supabase.rpc('admin_bulk_upsert_questions', {
            p_quiz_id: quiz.id,
            p_payload: finalItems,
            p_mode: 'replace',
          });
          if (rpcErr) throw rpcErr;

          // Success
          await supabase.from('ai_generation_jobs').update({ status: 'completed', provider_name: p.name, quiz_id: quiz.id }).eq('id', job.id);
          await supabase.from('ai_generation_logs').insert({ job_id: job.id, level: 'info', message: `Quiz created for ${category}`, context: { quiz_id: quiz.id, slot_start: s.start.toISOString() } });
          success = true;
          break;
        } catch (e: any) {
          lastErr = e?.message || String(e);
          await supabase
            .from('ai_generation_logs')
            .insert({ job_id: job.id, level: 'error', message: `Provider ${p.name} failed`, context: { error: lastErr } });
          // Mark provider error but don't disable automatically; operators can toggle
          await supabase.from('ai_providers').update({ last_error: lastErr, last_error_at: new Date().toISOString() }).eq('id', p.id);
          continue; // try next provider
        }
      }

      if (!success) {
        await supabase.from('ai_generation_jobs').update({ status: 'failed', error: lastErr || 'all providers failed' }).eq('id', job.id);
        await sendAlert(supabase, settings.alert_emails || [], `AI quiz generation failed (${category})`, lastErr || 'All providers failed');
      }
    }
  }

    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders(req) });
  } catch (e: any) {
    await logUnhandled(e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 500, headers: jsonHeaders(req) });
  }
});

async function logUnhandled(e: any) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await supabase.from('ai_generation_logs').insert({ level: 'error', message: 'unhandled', context: { error: e?.message || String(e) } });
  } catch (_) { /* noop */ }
}
