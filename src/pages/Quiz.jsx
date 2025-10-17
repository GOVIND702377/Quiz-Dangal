import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from '@/lib/motion-lite';
import { Button } from '@/components/ui/button';
import { formatDateOnly, formatTimeOnly, getPrizeDisplay } from '@/lib/utils';
import { useQuizEngine } from '@/hooks/useQuizEngine';
import { Loader2, CheckCircle, Clock, Users, X } from 'lucide-react';
import SEO from '@/components/SEO';

const Quiz = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const {
  quiz, questions, currentQuestionIndex, answers, quizState, timeLeft, submitting,
  joined, participantStatus, totalJoined, displayJoined,
    handleJoinOrPrejoin, handleAnswerSelect, handleSubmit,
    formatTime,
  } = useQuizEngine(quizId, navigate);

  const [resultsCountdownMs, setResultsCountdownMs] = useState(null);

  useEffect(() => {
    if (!quiz?.end_time) {
      setResultsCountdownMs(null);
      return;
    }
    if (!(quizState === 'completed' || quizState === 'finished')) {
      setResultsCountdownMs(null);
      return;
    }
    const target = new Date(quiz.end_time).getTime();
    const update = () => {
      const diff = Math.max(0, target - Date.now());
      setResultsCountdownMs(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [quiz?.end_time, quizState]);

  const renderResultCountdown = () => {
    if (!quiz?.end_time) {
      return <p className="text-slate-300">Results will be published soon.</p>;
    }
    const ms = resultsCountdownMs ?? Math.max(0, new Date(quiz.end_time).getTime() - Date.now());
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const Part = ({ value, label }) => (
      <div className="px-3 py-2 rounded-md bg-slate-800/70 border border-slate-700 min-w-[64px]">
        <div className="text-xl font-bold text-white tabular-nums">{value.toString().padStart(2, '0')}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    );

    return (
      <div className="space-y-4">
        <p className="text-slate-300">Results will be published soon.</p>
        <div className="flex items-center justify-center gap-2">
          {days > 0 && <Part value={days} label="Days" />}
          <Part value={hours} label="Hours" />
          <Part value={minutes} label="Minutes" />
          <Part value={seconds} label="Seconds" />
        </div>
        <div className="text-xs text-slate-400">
          Expected publish time: {new Date(quiz.end_time).toLocaleString()}
        </div>
      </div>
    );
  };

  // All lifecycle & actions handled by useQuizEngine

  if (quizState === 'loading' || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SEO
          title="Quiz – Loading | Quiz Dangal"
          description="Loading quiz details."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quizId}` : 'https://quizdangal.com/quiz'}
          robots="noindex, nofollow"
        />
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
  const prizeType = quiz.prize_type || 'coins';
    const p1 = prizes[0] ?? 0;
    const p2 = prizes[1] ?? 0;
    const p3 = prizes[2] ?? 0;
    const formatPrize = (value) => {
  const display = getPrizeDisplay(prizeType, value, { fallback: 0 });
  // Plain text only, no coin icon before amount
  return display.formatted;
    };
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-700/30">1st {formatPrize(p1)}</span>
        <span className="px-2 py-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-700/30">2nd {formatPrize(p2)}</span>
        <span className="px-2 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-700/30">3rd {formatPrize(p3)}</span>
      </div>
    );
  };

  // Show pre-lobby if not joined yet
    // TODO: Extract LobbyView component (pre-join & join) to components/quiz/LobbyView.jsx
  if (!joined && quizState !== 'completed') {
    const now = new Date();
    const st = quiz.start_time ? new Date(quiz.start_time) : null;
    const et = quiz.end_time ? new Date(quiz.end_time) : null;
    const isActive = quiz.status === 'active' && st && et && now >= st && now < et;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SEO
          title={`${quiz.title || 'Quiz'} – Lobby | Quiz Dangal`}
          description="Join the quiz lobby."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quizId}` : 'https://quizdangal.com/quiz'}
          robots="noindex, nofollow"
        />
  <m.div
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
              {displayJoined} joined
            </div>
          </div>
          <PrizeChips />
          <InfoChips />
          <div className="mt-6">
            <Button onClick={handleJoinOrPrejoin} className={isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}>
              {isActive ? 'Join & Start' : 'Pre-Join'}
            </Button>
          </div>
  </m.div>
      </div>
    );
  }
  if (quizState === 'waiting') {
    // TODO: Extract WaitingView component
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SEO
          title={`${quiz.title || 'Quiz'} – Waiting | Quiz Dangal`}
          description="Waiting for the quiz to start."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quizId}` : 'https://quizdangal.com/quiz'}
          robots="noindex, nofollow"
        />
  <m.div
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
  </m.div>
      </div>
    );
  }

  // Show completed/finished state with countdown - NO LOADING, DIRECT TIMER
  if (quizState === 'completed' || quizState === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SEO
          title={`${quiz.title || 'Quiz'} – Completed | Quiz Dangal`}
          description="Quiz completed. Results will be published soon."
          canonical={typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quizId}` : 'https://quizdangal.com/quiz'}
          robots="noindex, nofollow"
        />
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="qd-card rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100"
        >
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Quiz Submitted Successfully!
          </h2>
          <p className="text-slate-300 mb-4">
            Thank you for participating!
          </p>
          {renderResultCountdown()}
          <div className="mt-6">
            <Button 
              onClick={() => navigate('/')} 
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Home
            </Button>
          </div>
        </m.div>
      </div>
    );
  }

  // Active quiz state
  if (questions.length === 0) {
    // TODO: Extract EmptyQuestionsView component
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
      <SEO
        title={`${quiz.title || 'Quiz'} – Play | Quiz Dangal`}
        description="Answer questions and compete to win."
        canonical={typeof window !== 'undefined' ? `${window.location.origin}/quiz/${quizId}` : 'https://quizdangal.com/quiz'}
        robots="noindex, nofollow"
      />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
  <m.div
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
            <m.div
              className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8,#a78bfa,#f472b6)]"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
  </m.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <m.div
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
                  <m.button
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
                    </m.button>
                );
              })}
            </div>

            {/* Submit Button (only on last question) */}
            {currentQuestionIndex === questions.length - 1 && Object.keys(answers).length === questions.length && (
              <m.div
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
              </m.div>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;