// Smart join helper to reduce 400 errors from early join attempts.
// Handles timing windows, pre-join fallback, scheduled precise retry near start boundary,
// and deduplicates concurrent join attempts for the same quiz id.
// Returns a result object { status, scheduledAt?, error? }.
// Possible status values:
//   'joined'          -> join_quiz succeeded (or already joined/completed treated as joined)
//   'pre_joined'      -> pre_join_quiz succeeded
//   'scheduled_retry' -> pre-joined and scheduled a precise future join attempt
//   'already'         -> user already joined/completed (no further action)
//   'error'           -> unrecoverable error

import { logger } from '@/lib/logger';

const scheduledMap = new Map(); // quizId -> timeout id

export async function smartJoinQuiz({ supabase, quiz, user }) {
  if (!supabase || !quiz || !quiz.id) return { status: 'error', error: new Error('Missing quiz or supabase client') };
  if (!user || !user.id) return { status: 'error', error: new Error('Not authenticated') };

  try {
    const startMs = quiz.start_time ? new Date(quiz.start_time).getTime() : null;
    const endMs = quiz.end_time ? new Date(quiz.end_time).getTime() : null;
    const now = Date.now();
    if (!startMs || !endMs) {
      // Fallback: treat as pre-joinable
      const { error: pjErr } = await supabase.rpc('pre_join_quiz', { p_quiz_id: quiz.id });
      if (pjErr) return { status: 'error', error: pjErr };
      return { status: 'pre_joined' };
    }

    const graceMs = 5000; // server grace before start
    const active = now >= (startMs - graceMs) && now < endMs;
    const veryEarlyThreshold = startMs - (graceMs + 1500); // far before grace

    // Far before start: just pre-join once
    if (now < veryEarlyThreshold) {
      const { error: pjErr } = await supabase.rpc('pre_join_quiz', { p_quiz_id: quiz.id });
      if (pjErr) return { status: 'error', error: pjErr };
      return { status: 'pre_joined' };
    }

    // Borderline window: close to start but not yet within active detection
    if (!active && now >= veryEarlyThreshold && now < (startMs - 300)) {
      // Pre-join then schedule precise join attempt just inside grace
      const { error: pjErr } = await supabase.rpc('pre_join_quiz', { p_quiz_id: quiz.id });
      if (pjErr) return { status: 'error', error: pjErr };
      if (!scheduledMap.has(quiz.id)) {
        const delay = Math.max(50, (startMs - (graceMs - 100)) - Date.now()); // aim slightly before grace start
        const tid = setTimeout(async () => {
          scheduledMap.delete(quiz.id);
          try {
            const { error } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id });
            if (error) {
              const msg = String(error.message || '').toLowerCase();
              if (msg.includes('already') || msg.includes('completed')) {
                logger.debug('Scheduled join: already joined/completed', quiz.id);
                return;
              }
              if (msg.includes('not active')) {
                logger.debug('Scheduled join: still not active, giving up this cycle', quiz.id);
                return;
              }
              logger.error('Scheduled join error', error.message || error);
            } else {
              logger.debug('Scheduled join success', quiz.id);
            }
          } catch (e) {
            logger.error('Scheduled join throw', e?.message || e);
          }
        }, delay);
        scheduledMap.set(quiz.id, tid);
        return { status: 'scheduled_retry', scheduledAt: Date.now() + delay };
      }
      return { status: 'scheduled_retry', scheduledAt: null }; // already scheduled
    }

    // Active window: attempt join directly
    if (active) {
      const { error } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id });
      if (!error) return { status: 'joined' };
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('completed')) return { status: 'already' };
      if (msg.includes('not active')) {
        // Schedule a retry very near start boundary (final chance)
        if (!scheduledMap.has(quiz.id)) {
          const delay = 600; // small fixed backoff
          const tid = setTimeout(async () => {
            scheduledMap.delete(quiz.id);
            try {
              const { error: err2 } = await supabase.rpc('join_quiz', { p_quiz_id: quiz.id });
              if (err2 && !String(err2.message || '').toLowerCase().includes('already')) {
                logger.error('Final join retry failed', err2.message || err2);
              }
            } catch (e) { logger.error('Final join retry throw', e?.message || e); }
          }, delay);
          scheduledMap.set(quiz.id, tid);
          return { status: 'scheduled_retry', scheduledAt: Date.now() + delay };
        }
        return { status: 'scheduled_retry', scheduledAt: null };
      }
      return { status: 'error', error };
    }

    // After end time or outside window: pre-join fallback (so user tracked) if not completed
    const { error: pjErr2 } = await supabase.rpc('pre_join_quiz', { p_quiz_id: quiz.id });
    if (pjErr2) return { status: 'error', error: pjErr2 };
    return { status: 'pre_joined' };
  } catch (e) {
    return { status: 'error', error: e };
  }
}

export function cancelScheduledSmartJoin(quizId) {
  if (scheduledMap.has(quizId)) {
    clearTimeout(scheduledMap.get(quizId));
    scheduledMap.delete(quizId);
  }
}
