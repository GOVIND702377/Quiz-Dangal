import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatDateOnly, formatTimeOnly } from '@/lib/utils';
import { Loader2, CheckCircle, Clock, Users, Trophy, X } from 'lucide-react';

const Quiz = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizState, setQuizState] = useState('loading'); // loading, waiting, active, finished, completed
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Engagement counts
  const [engagement, setEngagement] = useState({ joined: 0, pre_joined: 0 });
  const totalJoined = (engagement.joined || 0) + (engagement.pre_joined || 0);
  const [joined, setJoined] = useState(false);
  const [participantStatus, setParticipantStatus] = useState(null); // 'pre_joined' | 'joined' | 'completed' | null

  const loadQuestions = useCallback(async () => {
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        options (
          id,
          option_text
        )
      `)
      .eq('quiz_id', quizId)
      .order('id');
    if (!questionsError) {
      setQuestions(questionsData || []);
    } else {
      setQuestions([]);
    }
  }, [quizId]);

  const fetchQuizData = useCallback(async () => {
    try {
      // Get quiz details first (allow viewing lobby even if not joined)
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizError || !quizData) {
        toast({ title: "Error", description: "Quiz not found.", variant: "destructive" });
        navigate('/');
        return;
      }
      setQuiz(quizData);

      // Check if user already joined (only when logged in)
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

      // Load questions only if joined and not completed
      if (participant && participant.status !== 'completed') {
        await loadQuestions();
      }

      await refreshEngagement();

    } catch (error) {
      console.error('Error fetching quiz data:', error);
      toast({ title: "Error", description: "Failed to load quiz.", variant: "destructive" });
      navigate('/');
    }
  }, [quizId, user.id, navigate, toast, loadQuestions]);

  const refreshEngagement = useCallback(async () => {
    try {
      const { data: engagementData, error: engagementError } = await supabase
        .rpc('get_engagement_counts', { p_quiz_id: quizId });
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

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  // Timer logic (robust to missing times)
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
      // Otherwise, it's finished
      setQuizState('finished');
      setTimeLeft(0);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [quiz, quizState]);

  // Periodically refresh engagement counts while waiting/active
  useEffect(() => {
    if (!quiz) return;
    if (!(quizState === 'waiting' || quizState === 'active')) return;
    const id = setInterval(refreshEngagement, 15000);
    return () => clearInterval(id);
  }, [quiz, quizState, refreshEngagement]);

  // When timer flips to active: auto-join if pre-joined, then load questions
  useEffect(() => {
    const run = async () => {
      if (!quiz) return;
      if (quizState !== 'active') return;
      if (!user) return;
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

  // Auto-submit when quiz ends
  useEffect(() => {
    if (quizState === 'finished' && Object.keys(answers).length > 0 && !submitting) {
      handleSubmit();
    }
  }, [quizState]);

  const handleAnswerSelect = async (questionId, optionId) => {
    // Block changes if we're submitting, not in active state, or already completed
    if (submitting || quizState !== 'active' || participantStatus === 'completed') return;
    try {
      // Save answer to database immediately
      const { error } = await supabase
        .from('user_answers')
        .upsert(
          {
            user_id: user.id,
            question_id: questionId,
            selected_option_id: optionId,
          },
          {
            onConflict: 'user_id,question_id',
          }
        );

      if (error) throw error;

  // Update local state
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));

      // Move to next question after a short delay
      if (currentQuestionIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
        }, 500);
      }

      toast({
        title: "Answer Saved",
        description: "Your answer has been recorded.",
      });

    } catch (error) {
      console.error('Error saving answer:', error);
      toast({
        title: "Error",
        description: "Failed to save answer. Please try again.",
        variant: "destructive"
      });
  // no error tone; silent fail per requirement
    }
  };

  // Join or Pre-join from lobby
  const handleJoinOrPrejoin = async () => {
    if (!quiz) return;
    if (!user) { toast({ title: 'Login required', description: 'Please sign in to join the quiz.', variant: 'destructive' }); navigate('/login'); return; }
    if (participantStatus === 'completed') {
      toast({ title: 'Already submitted', description: 'You have already completed this quiz and cannot join again.', variant: 'destructive' });
      return;
    }
    const now = new Date();
    const st = quiz.start_time ? new Date(quiz.start_time) : null;
    const et = quiz.end_time ? new Date(quiz.end_time) : null;
    const isActive = quiz.status === 'active' && st && et && now >= st && now < et;
    const rpc = isActive ? 'join_quiz' : 'pre_join_quiz';
    try {
      const { error } = await supabase.rpc(rpc, { p_quiz_id: quizId });
      if (error) throw error;
      setJoined(true);
  // refresh counts immediately
  refreshEngagement();
      setParticipantStatus(isActive ? 'joined' : 'pre_joined');
      toast({ title: isActive ? 'Joined!' : 'Pre-joined!', description: isActive ? 'Starting now.' : 'We will remind you before start.' });
      // If active, fetch questions to begin
      if (isActive) {
        await loadQuestions();
        setQuizState('active');
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.message || 'Could not join.', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Update participant status
      const { error } = await supabase
        .from('quiz_participants')
        .update({ status: 'completed' })
        .eq('user_id', user.id)
        .eq('quiz_id', quizId);

      if (error) throw error;

      toast({
        title: "Quiz Completed!",
        description: "Your answers have been submitted. Results will be announced soon!",
      });
      // click sound handled globally on button press

      setQuizState('completed');
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/my-quizzes');
      }, 3000);

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        title: "Submission Failed",
        description: "Could not submit your answers. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (quizState === 'loading' || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-accent-b mx-auto mb-4" />
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  const InfoChips = () => (
    <div className="mt-3 text-xs text-slate-300">
      <div className="text-[11px] text-slate-400">{quiz.start_time ? formatDateOnly(quiz.start_time) : '—'}</div>
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          <div className="uppercase tracking-wide text-[10px] text-slate-400">Start</div>
          <div>{quiz.start_time ? formatTimeOnly(quiz.start_time) : '—'}</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          <div className="uppercase tracking-wide text-[10px] text-slate-400">End</div>
          <div>{quiz.end_time ? formatTimeOnly(quiz.end_time) : '—'}</div>
        </div>
      </div>
    </div>
  );

  const PrizeChips = () => {
    const prizes = Array.isArray(quiz.prizes) ? quiz.prizes : [];
    const p1 = prizes[0] || 0, p2 = prizes[1] || 0, p3 = prizes[2] || 0;
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-700/30">1st ₹{p1}</span>
        <span className="px-2 py-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-700/30">2nd ₹{p2}</span>
        <span className="px-2 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-700/30">3rd ₹{p3}</span>
      </div>
    );
  };

  // Show pre-lobby if not joined yet
  if (!joined && quizState !== 'completed') {
    const now = new Date();
    const st = quiz.start_time ? new Date(quiz.start_time) : null;
    const et = quiz.end_time ? new Date(quiz.end_time) : null;
    const isActive = quiz.status === 'active' && st && et && now >= st && now < et;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="qd-card relative rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100 w-full"
        >
          {/* Close (X) */}
          <button
            aria-label="Close"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <Clock className="h-16 w-16 text-accent-b mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white text-shadow-sm mb-2">{quiz.title}</h2>
          <p className="text-slate-300 mb-1">{isActive ? 'Quiz is live!' : 'Quiz starts in:'}</p>
          <div className="text-4xl font-bold text-indigo-300 mb-4">{formatTime(timeLeft)}</div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-300">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {totalJoined} joined
            </div>
          </div>
          <PrizeChips />
          <InfoChips />
          <div className="mt-6">
            <Button onClick={handleJoinOrPrejoin} className={isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}>
              {isActive ? 'Join & Start' : 'Pre-Join'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }
  if (quizState === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="qd-card rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100"
        >
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Completed!</h2>
          <p className="text-slate-300 mb-4">You have already submitted your answers for this quiz.</p>
          <Button onClick={() => navigate('/my-quizzes')} variant="brand" className="w-full">
            View My Quizzes
          </Button>
        </motion.div>
      </div>
    );
  }

  if (quizState === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="qd-card relative rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100"
        >
          {/* Close (X) */}
          <button
            aria-label="Close"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <Clock className="h-16 w-16 text-accent-b mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white text-shadow-sm mb-2">{quiz.title}</h2>
          <p className="text-slate-300 mb-1">Quiz starts in:</p>
          <div className="text-4xl font-bold text-indigo-300 mb-4">
            {formatTime(timeLeft)}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-300">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {totalJoined} joined
            </div>
          </div>
          <PrizeChips />
          <InfoChips />
          <div className="mt-4 text-xs text-slate-400">We’ll auto-start when the timer hits zero.</div>
        </motion.div>
      </div>
    );
  }

  if (quizState === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="qd-card rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100"
        >
          <Clock className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Ended</h2>
          <p className="text-slate-300 mb-4">The quiz has ended. Results will be announced soon!</p>
          {submitting && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Submitting your answers...</span>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Active quiz state
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No questions available for this quiz.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen p-4 bg-[radial-gradient(1000px_600px_at_50%_-100px,rgba(59,130,246,0.25),transparent),radial-gradient(800px_500px_at_120%_0,rgba(168,85,247,0.18),transparent)]">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-6 text-slate-100 border border-slate-800/60 bg-slate-900/60 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">{quiz.title}</h1>
              <p className="text-xs text-slate-400">Question {currentQuestionIndex + 1} of {questions.length}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-rose-300 tabular-nums">{formatTime(timeLeft)}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Time Left</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800/60 rounded-full h-2 mt-4 overflow-hidden">
            <motion.div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8,#a78bfa,#f472b6)]"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl p-6 text-slate-100 border border-slate-800/60 bg-slate-900/60 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <h2 className="text-xl font-bold text-center text-white mb-6 leading-relaxed">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options?.map((option, index) => {
                const selected = answers[currentQuestion.id] === option.id;
                return (
                  <motion.button
                    key={option.id}
                    onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                    disabled={submitting || quizState !== 'active' || participantStatus === 'completed'}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full p-4 rounded-xl text-left font-medium transition-all duration-200 border group relative overflow-hidden ${
                      selected
                        ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-[0_10px_24px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-800/70 hover:bg-slate-800 text-slate-100 border-slate-700/80'
                    }`}
                  >
                    <span className={`font-bold mr-3 ${selected ? 'text-white' : 'text-indigo-300'}`}>
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option.option_text}
                    {!selected && (
                      <span className="absolute inset-y-0 right-0 w-0 group-hover:w-1/6 transition-[width] duration-200 bg-gradient-to-l from-indigo-500/20 to-transparent" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Submit Button (only on last question) */}
            {currentQuestionIndex === questions.length - 1 && Object.keys(answers).length === questions.length && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-7"
              >
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full text-white font-extrabold py-4 text-lg border border-violet-500/40 shadow-[0_8px_18px_rgba(139,92,246,0.35)] hover:shadow-[0_12px_24px_rgba(139,92,246,0.55)] bg-[linear-gradient(90deg,#4f46e5,#7c3aed,#9333ea,#c026d3)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-6 w-6" />
                      Submit Quiz
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;