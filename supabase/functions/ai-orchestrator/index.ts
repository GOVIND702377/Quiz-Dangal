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

// Small utility: fetch with timeout to avoid long hangs that cause 504s at the gateway
async function fetchWithTimeout(input: string | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20_000, ...rest } = init as any;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), Math.max(1_000, Number(timeoutMs)));
  try {
    const resp = await fetch(input, { ...rest, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

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
type QuizPayload = { title: string; items: { question_text: string; options: { option_text: string; is_correct: boolean }[] }[] };
type ProviderResult = { ok: true; payload: QuizPayload; status: number } | { ok: false; error: string; status: number };
async function callProvider(name: string, apiKey: string, prompt: string): Promise<ProviderResult> {
  const provider = String(name || '').toLowerCase();
  if (!apiKey) return null;

  // Common system message to enforce strict JSON
  const system = `You are a strict JSON generator. Respond ONLY with valid minified JSON matching this schema:
  { "title": string, "items": [ { "question_text": string, "options": [ { "option_text": string, "is_correct": boolean }, {..}, {..}, {..} ] }, ... (10 items total) ] }
  No markdown, no code fences, no commentary.`;

  try {
    if (provider === 'openai') {
      const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
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
        timeoutMs: 20_000,
      });
      const status = resp.status;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return { ok: false, error: txt || `http_${status}`, status };
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: 'empty_content', status };
      return { ok: true, payload: JSON.parse(content), status };
    }

    if (provider === 'groq') {
      const resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
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
        timeoutMs: 20_000,
      });
      const status = resp.status;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return { ok: false, error: txt || `http_${status}`, status };
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: 'empty_content', status };
      // Some models may wrap in ```json fences—strip if present
      const cleaned = String(content).trim().replace(/^```json\n?|```$/g, '');
      return { ok: true, payload: JSON.parse(cleaned), status };
    }

    if (provider === 'anthropic' || provider === 'claude' || provider === 'anthropic-claude') {
      const resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
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
        timeoutMs: 20_000,
      });
      const status = resp.status;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return { ok: false, error: txt || `http_${status}`, status };
      }
      const data = await resp.json();
      const content = data?.content?.[0]?.text || data?.content?.[0]?.["text"] || '';
      if (!content) return { ok: false, error: 'empty_content', status };
      const cleaned = String(content).trim().replace(/^```json\n?|```$/g, '');
      return { ok: true, payload: JSON.parse(cleaned), status };
    }

    // Perplexity AI (OpenAI-compatible-ish chat completions)
    if (provider === 'perplexity' || provider === 'pplx' || provider === 'perplexity-ai') {
      async function pplxCall(model: string) {
        const resp = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt + '\nRespond with JSON only.' },
          ],
          temperature: 0.6,
          max_tokens: 2000,
        }),
        timeoutMs: 20_000,
      });
        return resp;
      }
      let resp = await pplxCall('sonar-pro');
      let status = resp.status;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        // If invalid model, retry with a safe default
        if (/invalid model/i.test(txt || '') || status === 400) {
          resp = await pplxCall('sonar');
          status = resp.status;
        }
        if (!resp.ok) {
          const t2 = await resp.text().catch(() => '');
          return { ok: false, error: t2 || txt || `http_${status}`, status };
        }
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: 'empty_content', status };
      const cleaned = String(content).trim().replace(/^```json\n?|```$/g, '');
      return { ok: true, payload: JSON.parse(cleaned), status };
    }
  } catch (_) {
    return { ok: false, error: 'exception', status: 0 };
  }
  return { ok: false, error: 'unknown_provider', status: 0 };
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

// Helpers for title formatting in IST with bilingual fallback
function formatISTHHMM(date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const parts = fmt.formatToParts(date);
    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    return `${hh}:${mm}`;
  } catch {
    // Fallback to UTC if tz not available
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

function categoryLabels(cat: string): { hi: string; en: string } {
  const c = String(cat || '').toLowerCase();
  if (c === 'gk' || c === 'general_knowledge' || c === 'general-knowledge') return { hi: 'सामान्य ज्ञान', en: 'General Knowledge' };
  if (c === 'sports') return { hi: 'खेल', en: 'Sports' };
  if (c === 'movies' || c === 'bollywood' || c === 'films') return { hi: 'फिल्में', en: 'Movies' };
  if (c === 'opinion') return { hi: 'राय', en: 'Opinion' };
  return { hi: c, en: c.charAt(0).toUpperCase() + c.slice(1) };
}

function isGenericTitle(title: string, cat: string): boolean {
  const t = String(title || '').toLowerCase().trim();
  if (!t) return true;
  if (t.length < 5) return true;
  const bad = ['quiz', 'gk', 'sports', 'movies', 'opinion', 'bilingual', 'today'];
  const tokens = t.replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  // too many generic tokens or repetitive
  const genericCount = tokens.filter(w => bad.includes(w)).length;
  if (genericCount >= Math.max(2, Math.floor(tokens.length * 0.6))) return true;
  return false;
}

function makeBilingualTitle(cat: string, startAt: Date, provided?: string): string {
  const { hi, en } = categoryLabels(cat);
  const hhmm = formatISTHHMM(startAt);
  const base = `आज का ${hi} क्विज़ (${en} Quiz) – ${hhmm} IST`;
  const t = String(provided || '').trim();
  if (!t || isGenericTitle(t, cat)) return base;
  // Ensure bilingual: if missing English part, append; if missing Hindi, prepend simple Hindi label
  const hasEnglish = /\(.*\)/.test(t) || /[A-Za-z]/.test(t);
  const hasHindi = /[\p{Script=Devanagari}]/u.test(t);
  let out = t;
  if (!hasEnglish) out = `${out} (${en} Quiz)`;
  if (!hasHindi) out = `आज का ${hi} क्विज़ – ${out}`;
  // append time marker softly if not present
  if (!/\b\d{1,2}:\d{2}\b/.test(out)) out = `${out} – ${hhmm} IST`;
  return out;
}

// Ensure exactly one correct option for non-opinion quizzes
function normalizeCorrectness(items: any[]): any[] {
  return items.map((q: any) => {
    const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
    let firstTrueIndex = opts.findIndex((o: any) => o?.is_correct === true);
    const trueCount = opts.filter((o: any) => o?.is_correct === true).length;
    // If multiple trues, keep the first and flip others to false
    if (trueCount > 1) {
      if (firstTrueIndex < 0) firstTrueIndex = 0;
      return {
        question_text: q.question_text,
        options: opts.map((o: any, i: number) => ({ option_text: String(o.option_text || '').trim(), is_correct: i === firstTrueIndex })),
      };
    }
    // If none true, default the first option to correct
    if (trueCount === 0) {
      return {
        question_text: q.question_text,
        options: opts.map((o: any, i: number) => ({ option_text: String(o.option_text || '').trim(), is_correct: i === 0 })),
      };
    }
    // Exactly one true already
    return {
      question_text: q.question_text,
      options: opts.map((o: any) => ({ option_text: String(o.option_text || '').trim(), is_correct: !!o.is_correct })),
    };
  });
}

// Direct insert fallback using service role
async function insertQuestionsDirect(supabase: any, quizId: string, items: any[], mode: 'append' | 'replace' = 'append') {
  if (mode === 'replace') {
    await supabase.from('questions').delete().eq('quiz_id', quizId);
  }
  for (const it of items) {
    const { data: qrow, error: qerr } = await supabase
      .from('questions')
      .insert({ quiz_id: quizId, question_text: it.question_text })
      .select('id')
      .single();
    if (qerr) throw qerr;
    const rows = (it.options || []).slice(0, 4).map((o: any) => ({
      question_id: qrow.id,
      option_text: String(o.option_text || '').trim(),
      is_correct: !!o.is_correct,
    }));
    if (rows.length) {
      const { error: oerr } = await supabase.from('options').insert(rows);
      if (oerr) throw oerr;
    }
  }
}

// Lightweight text normalizer and in-payload dedupe for question texts
function normText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // remove bracket translations
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeItems(items: any[]): { unique: any[]; removed: number } {
  const seen = new Set<string>();
  const unique: any[] = [];
  let removed = 0;
  for (const it of items) {
    const key = normText(it?.question_text ?? '');
    if (!key) continue;
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    unique.push({
      question_text: String(it?.question_text || '').trim(),
      options: (Array.isArray(it?.options) ? it.options : []).map((op: any) => ({
        option_text: String(op?.option_text || '').trim(),
        is_correct: !!op?.is_correct,
      })),
    });
  }
  return { unique, removed };
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
  const maxJobsParam = url.searchParams.get('limit');
  const maxJobs = Math.max(1, Math.min(6, Number(maxJobsParam || 3))); // cap to keep runs short

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
      // Log once in case automation was toggled off, to make it visible in logs
      try { await supabase.from('ai_generation_logs').insert({ level: 'info', message: 'ai automation disabled', context: { when: new Date().toISOString() } }); } catch (_) { /* noop */ }
      return new Response(JSON.stringify({ ok: true, message: 'disabled' }), { headers: jsonHeaders(req) });
    }

  const now = new Date();
  const cadence = Number(settings.cadence_min || 10);
  const liveMin = Number(settings.live_window_min || 7);
  const startOffsetSec = Math.max(0, Number(settings.start_offset_sec || 10));
  const slotStart = alignToCadence(now, cadence);
  const nextSlotStart = new Date(slotStart.getTime() + cadence * 60_000);
  const nextNextSlotStart = new Date(slotStart.getTime() + 2 * cadence * 60_000);

  // Info: gap derived from cadence - liveMin; log if negative or unusually small
  const expectedGap = cadence - liveMin;
  if (expectedGap < 0) {
    await supabase.from('ai_generation_logs').insert({ level: 'warn', message: 'invalid scheduling: live_window_min exceeds cadence', context: { cadence_min: cadence, live_window_min: liveMin } });
  } else if (expectedGap < 1) {
    await supabase.from('ai_generation_logs').insert({ level: 'info', message: 'tight gap between quizzes', context: { cadence_min: cadence, live_window_min: liveMin, gap_min: expectedGap } });
  }

  const categories: string[] = settings.categories || [];

  let jobsBudget = maxJobs;
  for (const category of categories) {
    // Maintain up to two future upcoming quizzes in addition to the current slot
    const slots = [
      { start: slotStart, end: new Date(slotStart.getTime() + liveMin * 60_000) },
      { start: nextSlotStart, end: new Date(nextSlotStart.getTime() + liveMin * 60_000) },
      { start: nextNextSlotStart, end: new Date(nextNextSlotStart.getTime() + liveMin * 60_000) },
    ];

  for (const s of slots) {
      if (jobsBudget <= 0) break;
      // Skip current slot if we're too close or past start (to avoid start-time edit locks)
      const leadMs = s.start.getTime() - Date.now();
      if (leadMs <= startOffsetSec * 1000) {
        // Only skip for the first slot (current). The second (next) will have enough lead time.
        if (s.start.getTime() === slotStart.getTime()) {
          await supabase.from('ai_generation_logs').insert({ level: 'info', message: 'skip current slot (insufficient lead time)', context: { category, slot_start: s.start.toISOString(), lead_ms: leadMs } });
          continue;
        }
      }
      // Insert or get existing job for each slot (idempotent)
      let job: any = null;
      const iresp = await supabase
        .from('ai_generation_jobs')
        .insert({ category, slot_start: s.start.toISOString(), slot_end: s.end.toISOString(), status: 'queued' })
        .select('*')
        .single();
      if (iresp.error) {
        // Likely unique(category, slot_start) violation from a previous run; fetch existing row
        const gresp = await supabase
          .from('ai_generation_jobs')
          .select('*')
          .eq('category', category)
          .eq('slot_start', s.start.toISOString())
          .maybeSingle();
        job = gresp.data;
      } else {
        job = iresp.data;
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

      // Fetch recent titles for uniqueness guidance
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('quizzes')
        .select('title')
        .eq('category', category)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);
      const avoidTitles = (recent || []).map((r: any) => String(r.title || '').trim()).filter(Boolean);

      // Fetch recent question stems (48h) to discourage repetition
      const { data: recentQs } = await supabase
        .from('questions')
        .select('question_text, created_at')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .limit(50);
      const avoidStems = (recentQs || [])
        .map((q: any) => normText(q?.question_text || ''))
        .filter(Boolean)
        .slice(0, 25);

      // Hindi + English prompt with quality and uniqueness constraints
      const basePrompt = [
  `You are a Quiz Generator. Create exactly 10 multiple-choice questions for the category: ${category}.`,
        `Each question MUST be bilingual: Hindi main text + (English translation in brackets).`,
        `Title: unique, catchy, and clearly related to the category, also bilingual (Hindi + (English)). Avoid generic titles.`,
        `Options: exactly 4 per question. Keep options concise (not too short, not too long).`,
  `Aim for a balanced difficulty across the 10 questions (mix of easy/medium/hard).`,
        `Opinion category should be fun, engaging, and can ask lighthearted or trending preferences (no correct answer; set all options is_correct=false).`,
        `For non-opinion categories (sports, gk, movies): ensure factual correctness and exactly one correct option per question.`,
        `Prefer trending topics in India when reasonable (news, recent releases, viral subjects).`,
        `Avoid duplication with recent quizzes. Do NOT reuse or paraphrase these recent titles: ${avoidTitles.length ? avoidTitles.join(' | ') : 'None'}.`,
        `${avoidStems.length ? `Avoid repeating these recent question ideas: ${avoidStems.join(' | ')}` : ''}`,
        `Avoid options like 'All of the above' or 'None of the above'. Use clear, distinct choices.`,
        `Return STRICT JSON with this shape: { title: string, items: Array<{ question_text: string, options: Array<{ option_text: string, is_correct: boolean }> }> }`,
        `Make sure there are exactly 10 items and exactly 4 options in each item.`
      ].join('\n');
      let prompt = basePrompt;

      for (const p of providers || []) {
        const apiKey = p.api_key_enc || '';
        try {
          let attempt = 0;
          let finalItems: any[] | null = null;
          let payload: any = null;
          let lastErrLocal: string | null = null;
          let usedPrompt = prompt;

          while (attempt < 2 && !finalItems) {
            attempt++;
            const resp = await callProvider(p.name, apiKey, usedPrompt);
            if (!resp?.ok) {
              // Detect quota/unauthorized for provider
              if (resp?.status === 429 || /rate.?limit|quota/i.test(resp?.error || '')) {
                await supabase.from('ai_providers').update({ last_error: 'rate_limited', last_error_at: new Date().toISOString(), quota_exhausted: true }).eq('id', p.id);
                await sendAlert(supabase, settings.alert_emails || [], `AI provider quota exhausted (${p.name})`, `Provider ${p.name} returned 429/rate limit. Marked as quota_exhausted.`);
              } else if (resp?.status === 401 || resp?.status === 403 || /unauthorized|invalid api/i.test(resp?.error || '')) {
                await supabase.from('ai_providers').update({ last_error: 'unauthorized', last_error_at: new Date().toISOString() }).eq('id', p.id);
              }
              lastErrLocal = resp?.error || 'provider returned no data';
              break; // provider hard failure for this provider
            }
            payload = resp.payload;

            // Normalize and validate payload strictly
            const rawItems = Array.isArray(payload.items) ? payload.items : [];
            if (rawItems.length !== 10) {
              lastErrLocal = 'invalid item count (need exactly 10)';
              usedPrompt = basePrompt + '\nRETRY: Ensure exactly 10 unique items. No duplicates.';
              continue;
            }
            const normalized = rawItems.map((it: any) => ({
              question_text: String(it?.question_text ?? '').trim(),
              options: (Array.isArray(it?.options) ? it.options : []).map((op: any) => ({
                option_text: String(op?.option_text ?? '').trim(),
                is_correct: !!op?.is_correct,
              })),
            }));
            // In-payload dedupe
            const { unique, removed } = dedupeItems(normalized);
            if (removed > 0) {
              await supabase.from('ai_generation_logs').insert({ job_id: job.id, level: 'warn', message: 'dedupe removed duplicate questions within payload', context: { removed, category } });
            }
            if (unique.length !== 10) {
              lastErrLocal = 'dedupe reduced items below 10';
              usedPrompt = basePrompt + `\nRETRY: Provide completely different 10 questions.`;
              continue;
            }
            // Exactly 4 options per question
            const shapeOk = unique.every((q: any) => Array.isArray(q.options) && q.options.length === 4 && q.question_text.length > 0 && q.options.every((o: any) => o.option_text.length > 0));
            if (!shapeOk) {
              lastErrLocal = 'invalid options shape (need exactly 4 options with non-empty text)';
              usedPrompt = basePrompt + '\nRETRY: Ensure exactly 4 options with non-empty text for each question.';
              continue;
            }

            const isOpinion = String(category).toLowerCase() === 'opinion';
            let itemsCandidate = unique;
            if (isOpinion) {
              // Force no-correct for opinion quizzes
              itemsCandidate = itemsCandidate.map((q: any) => ({
                question_text: q.question_text,
                options: q.options.map((o: any) => ({ option_text: o.option_text, is_correct: false })),
              }));
            } else {
              // Non-opinion: enforce exactly one correct per question (normalize if needed)
              const ok = itemsCandidate.every((q: any) => q.options.filter((o: any) => o.is_correct === true).length === 1);
              if (!ok) {
                itemsCandidate = normalizeCorrectness(itemsCandidate);
                const stillBad = itemsCandidate.some((q: any) => q.options.filter((o: any) => o.is_correct === true).length !== 1);
                if (stillBad) {
                  lastErrLocal = 'failed to normalize correctness to single true';
                  usedPrompt = basePrompt + '\nRETRY: Exactly one correct option per question.';
                  continue;
                }
                await supabase.from('ai_generation_logs').insert({ job_id: job.id, level: 'warn', message: 'normalized correctness to single true', context: { category, slot_start: s.start.toISOString() } });
              }
            }
            finalItems = itemsCandidate;
          }
          if (!finalItems) throw new Error(lastErrLocal || 'provider returned no data');

          // Create quiz row
          const plannedStart = new Date(s.start.getTime() + startOffsetSec * 1000);
          const title = makeBilingualTitle(category, plannedStart, payload?.title);
          const { data: quiz, error: qErr } = await supabase
            .from('quizzes')
            .insert({
              title,
              category,
              prize_type: 'coins',
              prizes: [101, 71, 51],
              prize_pool: 101 + 71 + 51,
              start_time: plannedStart.toISOString(),
              end_time: new Date(s.end.getTime() + startOffsetSec * 1000).toISOString(),
              is_ai_generated: true,
            })
            .select('*')
            .single();
          if (qErr) throw qErr;

          // Upsert questions via RPC (admin path) with fallback to direct inserts
          let rpcUsed = false;
          try {
            const { error: rpcErr } = await supabase.rpc('admin_bulk_upsert_questions', {
              p_quiz_id: quiz.id,
              p_payload: finalItems,
              p_mode: 'replace',
            });
            if (rpcErr) throw rpcErr;
            rpcUsed = true;
          } catch (rpcError) {
            // Log and fallback to direct inserts
            await supabase.from('ai_generation_logs').insert({ job_id: job.id, level: 'warn', message: 'RPC admin_bulk_upsert_questions failed; using direct insert fallback', context: { error: rpcError?.message || String(rpcError), quiz_id: quiz.id } });
            await insertQuestionsDirect(supabase, quiz.id, finalItems, 'replace');
          }

          // Success
          await supabase.from('ai_generation_jobs').update({ status: 'completed', provider_name: p.name, quiz_id: quiz.id }).eq('id', job.id);
          await supabase.from('ai_generation_logs').insert({ job_id: job.id, level: 'info', message: `Quiz created for ${category}`, context: { quiz_id: quiz.id, slot_start: s.start.toISOString(), used_rpc: rpcUsed } });
          success = true;
          jobsBudget -= 1;
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
    return new Response(JSON.stringify({ ok: false, error: 'internal_error' }), { status: 500, headers: jsonHeaders(req) });
  }
});

async function logUnhandled(e: any) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await supabase.from('ai_generation_logs').insert({ level: 'error', message: 'unhandled', context: { error: e?.message || String(e) } });
  } catch (_) { /* noop */ }
}
