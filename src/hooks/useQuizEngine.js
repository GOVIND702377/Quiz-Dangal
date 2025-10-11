import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { isDocumentHidden } from '@/lib/visibility';
import { safeComputeResultsIfDue } from '@/lib/utils';
import { QUIZ_ENGAGEMENT_POLL_INTERVAL_MS, QUIZ_COMPLETION_REDIRECT_DELAY_MS } from '@/constants';

/**
 * useQuizEngine
 * Encapsulates quiz lifecycle: loading quiz, joining/pre-joining, questions, answers, timers, submission.
 * Includes resilient answer upsert retry queue for offline / transient failures (exponential backoff capped at 30s).
 */
export function useQuizEngine(quizId, navigate) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSubscribed, subscribeToPush } = usePushNotifications();

  // Core state
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizState, setQuizState] = useState('loading'); // loading, waiting, active, finished, completed
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [engagement, setEngagement] = useState({ joined: 0, pre_joined: 0 });
  const [joined, setJoined] = useState(false);
  const [participantStatus, setParticipantStatus] = useState(null); // 'pre_joined' | 'joined' | 'completed' | null

  // Internal refs
  const redirectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const retryQueueRef = useRef([]); // { questionId, optionId, attempt }
  const retryTimerRef = useRef(null);

  useEffect(() => () => {
    mountedRef.current = false;
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  // Retry queue helpers
  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current || retryQueueRef.current.length === 0) return;
    // compute next delay based on first item's attempt (simple heuristic)
    const next = retryQueueRef.current[0];
    const base = 2000 * Math.pow(2, (next.attempt || 1) - 1); // 2s,4s,8s...
    const delay = Math.min(base, 30000); // cap 30s
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      flushRetryQueue();
    }, delay);
  // Intentionally not depending on flushRetryQueue to avoid recreation loops; flushRetryQueue re-schedules itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushRetryQueue = useCallback(async () => {
    if (retryQueueRef.current.length === 0) return;
    const batch = [...retryQueueRef.current];
    retryQueueRef.current = [];
    for (const entry of batch) {
      if (!user || participantStatus === 'completed') continue;
      try {
        const { error } = await supabase
          .from('user_answers')
          .upsert({ user_id: user.id, question_id: entry.questionId, selected_option_id: entry.optionId }, { onConflict: 'user_id,question_id' });
        if (error) throw error;
        setAnswers(prev => ({ ...prev, [entry.questionId]: entry.optionId }));
      } catch (err) {
        const nextAttempt = (entry.attempt || 1) + 1;
        if (nextAttempt <= 6) { // attempts limit (~ up to 64s raw before cap)
          retryQueueRef.current.push({ ...entry, attempt: nextAttempt });
        } else {
          toast({ title: 'Answer not saved', description: 'One answer failed to sync after multiple retries.', variant: 'destructive' });
        }
      }
    }
    if (retryQueueRef.current.length > 0) scheduleRetry();
  }, [participantStatus, user, toast, scheduleRetry]);

  // Flush on network online or when tab becomes visible
  useEffect(() => {
    const onlineHandler = () => flushRetryQueue();
    const visibilityHandler = () => { if (!isDocumentHidden()) flushRetryQueue(); };
    window.addEventListener('online', onlineHandler);
    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [flushRetryQueue]);

  const totalJoined = (engagement.joined || 0) + (engagement.pre_joined || 0);
  // Display rule: when active, show only actually joined (joined+completed); when upcoming, show interested (pre+joined)
  const displayJoined = (() => {
    if (quizState === 'active') return engagement.joined || 0;
    return totalJoined;
  })();

  const loadQuestions = useCallback(async () => {
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select(`id, question_text, options ( id, option_text )`)
      .eq('quiz_id', quizId)
      .order('id');
    if (!questionsError) setQuestions(questionsData || []); else setQuestions([]);
  }, [quizId]);

  const refreshEngagement = useCallback(async () => {
    try {
      const { data: engagementData, error: engagementError } = await supabase.rpc('get_engagement_counts', { p_quiz_id: quizId });
      if (engagementError) {
        console.warn('Engagement counts fetch failed:', engagementError);
        setEngagement({ joined: 0, pre_joined: 0 });
      } else {
        const rec = Array.isArray(engagementData) ? engagementData[0] : engagementData;
        const j = Number(rec?.joined ?? 0);
        const pj = Number(rec?.pre_joined ?? 0);
        setEngagement({ joined: isNaN(j) ? 0 : j, pre_joined: isNaN(pj) ? 0 : pj });
      }
    } catch (e) {
      console.warn('Engagement refresh failed', e);
    }
  }, [quizId]);

  const fetchQuizData = useCallback(async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      if (quizError || !quizData) {
        toast({ title: 'Error', description: 'Quiz not found.', variant: 'destructive' });
        navigate('/');
        return;
      }
      setQuiz(quizData);

      let participant = null;
      if (user && user.id) {
        const { data: pData, error: pError } = await supabase
          .from('quiz_participants')
          .select('status')
          .eq('user_id', user.id)
          .eq('quiz_id', quizId)
          .maybeSingle();
        if (!pError && pData) {
          participant = pData;
          setJoined(true);
            setParticipantStatus(pData.status || null);
          if (participant.status === 'completed') setQuizState('completed');
        } else {
          setJoined(false);
          setParticipantStatus(null);
        }
      } else {
        setJoined(false);
        setParticipantStatus(null);
      }

      if (participant && participant.status !== 'completed') await loadQuestions();
      await refreshEngagement();
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      toast({ title: 'Error', description: 'Failed to load quiz.', variant: 'destructive' });
      navigate('/');
    }
    }, [quizId, user, navigate, toast, loadQuestions, refreshEngagement]); // user included

  useEffect(() => { fetchQuizData(); }, [fetchQuizData]);

  // Timer / phase management
  useEffect(() => {
    if (!quiz || quizState === 'completed') return;
    const update = () => {
      const now = new Date();
      const st = quiz.start_time ? new Date(quiz.start_time) : null;
      const et = quiz.end_time ? new Date(quiz.end_time) : null;
      const isUpcoming = st && now < st;
      const isActive = st && et && now >= st && now < et;
      if (isUpcoming) {
        setQuizState('waiting');
        setTimeLeft(Math.max(0, Math.round((st.getTime() - now.getTime()) / 1000)));
        return;
      }
      if (isActive) {
        setQuizState('active');
        setTimeLeft(Math.max(0, Math.round((et.getTime() - now.getTime()) / 1000)));
        return;
      }
      setQuizState('finished');
      setTimeLeft(0);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [quiz, quizState]);

  // Engagement polling, skip hidden
  useEffect(() => {
    if (!quiz) return; if (!(quizState === 'waiting' || quizState === 'active')) return;
    const tick = () => { if (isDocumentHidden()) return; refreshEngagement(); };
    const id = setInterval(tick, QUIZ_ENGAGEMENT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [quiz, quizState, refreshEngagement]);

  // Transition to active: join & load questions
  useEffect(() => {
    const run = async () => {
      if (!quiz) return; if (quizState !== 'active') return; if (!user) return;
      try {
        if (!joined || participantStatus === 'pre_joined') {
          const { error } = await supabase.rpc('join_quiz', { p_quiz_id: quizId });
          if (error) throw error;
          setJoined(true);
          setParticipantStatus('joined');
        }
        if (questions.length === 0) await loadQuestions();
      } catch (e) {
        toast({ title: 'Unable to start', description: e?.message || 'Could not start the quiz.', variant: 'destructive' });
      }
    };
    run();
  }, [quiz, quizState, user, joined, participantStatus, quizId, loadQuestions, questions.length, toast]);

  // Auto-submit on finish (if the user answered anything)
  useEffect(() => {
    if (quizState === 'finished' && Object.keys(answers).length > 0 && !submitting) {
      handleSubmit();
    }
  // Only react to quizState transitions; answers/submitting handled internally by handleSubmit side effects
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState]);

  // After finish/completion: trigger compute and navigate to Results immediately
  useEffect(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    if (!quiz?.end_time) return;
    if (!(quizState === 'finished' || quizState === 'completed')) return;

    const navigateToResults = () => {
      (async () => {
        try {
          await safeComputeResultsIfDue(supabase, quizId);
        } catch {
          /* ignore */
        }
        navigate(`/results/${quizId}`);
      })();
    };

    if (QUIZ_COMPLETION_REDIRECT_DELAY_MS > 0) {
      redirectTimeoutRef.current = setTimeout(() => {
        redirectTimeoutRef.current = null;
        navigateToResults();
      }, QUIZ_COMPLETION_REDIRECT_DELAY_MS);
    } else {
      navigateToResults();
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [quiz?.end_time, quizId, quizState, navigate]);

  const handleJoinOrPrejoin = useCallback(async () => {
    if (!quiz) return;
    if (!user) { toast({ title: 'Login required', description: 'Please sign in to join the quiz.', variant: 'destructive' }); navigate('/login'); return; }
    if (participantStatus === 'completed') {
      toast({ title: 'Already submitted', description: 'You have already completed this quiz and cannot join again.', variant: 'destructive' });
      return;
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && !isSubscribed) {
        await subscribeToPush();
      }
    } catch { /* ignore */ }
    const now = new Date();
    const st = quiz.start_time ? new Date(quiz.start_time) : null;
    const et = quiz.end_time ? new Date(quiz.end_time) : null;
    const isActive = quiz.status === 'active' && st && et && now >= st && now < et;
    const rpc = isActive ? 'join_quiz' : 'pre_join_quiz';
    try {
      const { error } = await supabase.rpc(rpc, { p_quiz_id: quizId });
      if (error) throw error;
      setJoined(true);
      refreshEngagement();
      setParticipantStatus(isActive ? 'joined' : 'pre_joined');
      toast({ title: isActive ? 'Joined!' : 'Pre-joined!', description: isActive ? 'Starting now.' : 'We will remind you before start.' });
      if (isActive) { await loadQuestions(); setQuizState('active'); }
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Could not join.', variant: 'destructive' });
    }
  }, [quiz, user, participantStatus, isSubscribed, subscribeToPush, quizId, toast, navigate, refreshEngagement, loadQuestions]);

  const handleAnswerSelect = useCallback(async (questionId, optionId) => {
    if (submitting || quizState !== 'active' || participantStatus === 'completed') return;
    try {
      const { error } = await supabase
        .from('user_answers')
        .upsert({ user_id: user.id, question_id: questionId, selected_option_id: optionId }, { onConflict: 'user_id,question_id' });
      if (error) throw error;
      setAnswers(prev => ({ ...prev, [questionId]: optionId }));
      if (currentQuestionIndex < questions.length - 1) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => setCurrentQuestionIndex(prev => prev + 1));
        } else {
          setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 250);
        }
      }
    } catch (error) {
      console.error('Error saving answer:', error);
      // Queue silently; inform user first time only for this question
      const alreadyQueued = retryQueueRef.current.some(e => e.questionId === questionId);
      if (!alreadyQueued) {
        toast({ title: 'Sync delayed', description: 'Network issue. Will retry automatically.', variant: 'destructive' });
      }
      retryQueueRef.current.push({ questionId, optionId, attempt: 1 });
      scheduleRetry();
    }
  }, [submitting, quizState, participantStatus, user?.id, currentQuestionIndex, questions.length, toast, scheduleRetry]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('quiz_participants')
        .update({ status: 'completed' })
        .eq('user_id', user.id)
        .eq('quiz_id', quizId);
      if (error) throw error;
      toast({ title: 'Quiz Completed!', description: 'Your answers have been submitted. Results will be announced soon!' });
      setQuizState('completed');
  try { await safeComputeResultsIfDue(supabase, quizId); } catch { /* ignore */ }
      navigate(`/results/${quizId}`);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({ title: 'Submission Failed', description: 'Could not submit your answers. Please try again.', variant: 'destructive' });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, user?.id, quizId, toast, navigate]);

  const formatTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // state
    quiz, questions, currentQuestionIndex, answers, quizState, timeLeft, submitting, engagement, joined, participantStatus, totalJoined, displayJoined,
    // setters
    setCurrentQuestionIndex,
    // actions
    handleJoinOrPrejoin, handleAnswerSelect, handleSubmit,
    // utils
    formatTime,
  };
}
