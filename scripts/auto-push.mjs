#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

// This script runs outside DB (e.g., cron or GitHub Actions). It finds due quizzes/results
// and calls the Edge Function in cron mode to send targeted pushes to participants only.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const EDGE_URL = `${SUPABASE_URL}/functions/v1/send-notifications`;
const CRON_SECRET = process.env.CRON_SECRET;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE || !CRON_SECRET) {
  console.error('Missing SUPABASE_URL, SERVICE_ROLE, or CRON_SECRET');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendEdge(payload) {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': CRON_SECRET,
      ...(ANON ? { 'Authorization': `Bearer ${ANON}` } : {}),
    },
    body: JSON.stringify({ ...payload, mode: 'cron' }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Edge err ${res.status}: ${txt}`);
  }
}

async function runStartSoon() {
  const { data, error } = await admin.from('v_start_soon_due').select('quiz_id, title');
  if (error) throw error;
  for (const row of data) {
    const quizId = row.quiz_id;
    await sendEdge({
      title: `${row.title || 'Quiz'} starts soon`,
      message: 'Get ready! Starting in 1 minute.',
      type: 'start_soon',
      segment: `participants:${quizId}`,
      quizId,
    });
    await admin.from('quizzes').update({ start_push_sent_at: new Date().toISOString() }).eq('id', quizId);
  }
}

async function runResultPush() {
  const { data, error } = await admin.from('v_result_push_due').select('quiz_id');
  if (error) throw error;
  for (const row of data) {
    const quizId = row.quiz_id;
    await sendEdge({
      title: 'Quiz Result',
      message: 'Results are out. Check your rank!',
      type: 'result',
      segment: `participants:${quizId}`,
      quizId,
    });
    await admin.from('quiz_results').update({ result_push_sent_at: new Date().toISOString() }).eq('quiz_id', quizId);
  }
}

(async () => {
  try {
    await runStartSoon();
    await runResultPush();
    console.log('Auto-push cycle complete');
  } catch (e) {
    console.error('Auto-push failed:', e);
    process.exit(1);
  }
})();
