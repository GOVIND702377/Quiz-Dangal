import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock, Users, Trophy } from 'lucide-react';

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
  const [participantCount, setParticipantCount] = useState(0);

  const fetchQuizData = useCallback(async () => {
    try {
      // Check if user is a participant
      const { data: participant, error: pError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('user_id', user.id)
        .eq('quiz_id', quizId)
        .single();

      if (pError || !participant) {
        toast({ title: "Not Joined", description: "You have not joined this quiz.", variant: "destructive" });
        navigate('/');
        return;
      }

      if (participant.status === 'completed') {
        setQuizState('completed');
        return;
      }

      // Get quiz details
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

      // Load base questions directly (no translations)
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

      if (questionsError || !questionsData || questionsData.length === 0) {
        toast({ title: "Error", description: "Could not load questions.", variant: "destructive" });
        navigate('/');
        return;
      }
      setQuestions(questionsData);

      // Get participant count
      const { count } = await supabase
        .from('quiz_participants')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .eq('status', 'joined');
      
      setParticipantCount(count || 0);

    } catch (error) {
      console.error('Error fetching quiz data:', error);
      toast({ title: "Error", description: "Failed to load quiz.", variant: "destructive" });
      navigate('/');
    }
  }, [quizId, user.id, navigate, toast]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  // Timer logic
  useEffect(() => {
    if (!quiz || quizState === 'loading' || quizState === 'completed') return;

    const update = () => {
      const now = new Date();
      const startTime = new Date(quiz.start_time);
      const endTime = new Date(quiz.end_time);

      if (now < startTime) {
        setQuizState('waiting');
        setTimeLeft(Math.max(0, Math.round((startTime - now) / 1000)));
      } else if (now >= startTime && now < endTime) {
        setQuizState('active');
        setTimeLeft(Math.max(0, Math.round((endTime - now) / 1000)));
      } else {
        setQuizState('finished');
        setTimeLeft(0);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [quiz, quizState]);

  // Auto-submit when quiz ends
  useEffect(() => {
    if (quizState === 'finished' && Object.keys(answers).length > 0 && !submitting) {
      handleSubmit();
    }
  }, [quizState]);

  const handleAnswerSelect = async (questionId, optionId) => {
    try {
      // Save answer to database immediately
      const { error } = await supabase
        .from('user_answers')
        .upsert({
          user_id: user.id,
          question_id: questionId,
          selected_option_id: optionId
        });

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
          className="qd-card rounded-2xl p-8 shadow-xl text-center max-w-md text-slate-100"
        >
          <Clock className="h-16 w-16 text-accent-b mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white text-shadow-sm mb-2">{quiz.title}</h2>
          <p className="text-slate-300 mb-4">Quiz starts in:</p>
          <div className="text-4xl font-bold text-indigo-300 mb-4">
            {formatTime(timeLeft)}
          </div>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {participantCount} joined
            </div>
            <div className="flex items-center">
              <Trophy className="h-4 w-4 mr-1" />
              ₹{quiz.prize_pool} prize pool
            </div>
          </div>
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
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="qd-card rounded-2xl p-4 shadow-lg mb-6 text-slate-100"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white">{quiz.title}</h1>
              <p className="text-sm text-slate-300">Question {currentQuestionIndex + 1} of {questions.length}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-400">{formatTime(timeLeft)}</div>
              <div className="text-xs text-slate-300">Time Left</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-700/40 rounded-full h-2 mt-4">
            <motion.div
              className="bg-accent-b h-2 rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="qd-card rounded-2xl p-6 shadow-lg text-slate-100"
          >
            <h2 className="text-xl font-bold text-center text-white text-shadow-sm mb-8">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-4">
              {currentQuestion.options?.map((option, index) => (
                <motion.button
                  key={option.id}
                  onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 rounded-xl text-left font-medium transition-all duration-200 shadow-md border ${
                    answers[currentQuestion.id] === option.id
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-100 border-slate-700'
                  }`}
                >
                  <span className="font-bold mr-3 text-accent-b">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option.option_text}
                </motion.button>
              ))}
            </div>

            {/* Submit Button (only on last question) */}
            {currentQuestionIndex === questions.length - 1 && Object.keys(answers).length === questions.length && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 text-lg"
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