import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock } from 'lucide-react';

const QuizStatus = ({ status, time }) => {
    return (
        <div className="text-center p-8 bg-white/80 rounded-2xl shadow-xl">
            <Clock className="mx-auto h-16 w-16 text-indigo-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{status}</h2>
            {time && <p className="text-gray-600">{new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
    )
}

const Quiz = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [questions, setQuestions] = useState([]);
  const [quizSchedule, setQuizSchedule] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizState, setQuizState] = useState('loading'); // loading, waiting, active, finished
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchQuizData = useCallback(async () => {
    // First, check if user is a participant
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
        toast({ title: "Quiz Completed", description: "You have already submitted your answers.", variant: "default" });
        navigate('/my-quizzes');
        return;
    }

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('quiz_schedule')
      .select('*')
      .eq('quiz_id', quizId)
      .single();

    if (scheduleError || !scheduleData) {
      toast({ title: "Error", description: "Quiz not found.", variant: "destructive" });
      navigate('/');
      return;
    }
    setQuizSchedule(scheduleData);

    // Determine quiz_id for questions (could be date based or from schedule)
    const questionQuizId = scheduleData.question_set_id || quizId;

    const { data: questionsData, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', questionQuizId)
      .order('question_order', { ascending: true });

    if (questionsError || questionsData.length === 0) {
      toast({ title: "Error", description: `Could not load questions for quiz ${questionQuizId}.`, variant: "destructive" });
      navigate('/');
      return;
    }
    setQuestions(questionsData);
    setQuizState('waiting'); // Move to waiting state after successful load
  }, [quizId, navigate, toast, user.id]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  const handleSubmit = useCallback(async (finalAnswers) => {
    if(submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('quiz_participants')
        .update({ answers: finalAnswers, status: 'completed' })
        .eq('user_id', user.id)
        .eq('quiz_id', quizId);
      
      if (error) throw error;
      
      toast({
        title: "Quiz Finished!",
        description: "Your answers are submitted. Results will be out soon!",
      });
      navigate('/my-quizzes');
    } catch (err) {
      console.error('Submission error:', err);
      toast({ title: "Submission Failed", description: "Could not save your answers.", variant: "destructive" });
    } finally {
        setSubmitting(false);
    }
  }, [quizId, user, navigate, toast, submitting]);
  
  useEffect(() => {
    if (!quizSchedule || quizState === 'loading') return;

    const timer = setInterval(() => {
      const now = new Date();
      const startTime = new Date(quizSchedule.start_time);
      const endTime = new Date(quizSchedule.end_time);

      if (now < startTime) {
        setQuizState('waiting');
      } else if (now >= startTime && now < endTime) {
        setQuizState('active');
        setTimeLeft(Math.round((endTime - now) / 1000));
      } else {
        setQuizState('finished');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [quizSchedule, quizState]);

  useEffect(() => {
    if (quizState === 'finished' && Object.keys(answers).length > 0 && !submitting) {
        handleSubmit(answers);
    }
  }, [quizState, handleSubmit, answers, submitting]);

  const handleAnswerSelect = (questionId, optionKey) => {
    const newAnswers = { ...answers, [questionId]: optionKey };
    setAnswers(newAnswers);
    
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300);
    }
  };
  
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const content = useMemo(() => {
    if (quizState === 'loading' || !quizSchedule || questions.length === 0) {
      return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-indigo-500" /></div>;
    }

    if (quizState === 'waiting') {
        return <QuizStatus status="Quiz starts soon" time={quizSchedule.start_time} />;
    }
    
    if (quizState === 'finished') {
        return <QuizStatus status="Quiz has ended" time={quizSchedule.end_time} />;
    }

    if (quizState === 'active') {
        const currentQuestion = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        return (
             <div className="w-full bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div className="font-bold text-lg text-gray-700">Question {currentQuestionIndex + 1}/{questions.length}</div>
                  <div className="font-bold text-lg bg-gradient-to-r from-pink-500 to-violet-500 text-white px-4 py-1 rounded-full shadow-md">
                    {formatTime(timeLeft)}
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                  <motion.div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  ></motion.div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6 min-h-[80px]">
                      {currentQuestion.question_text}
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                      {Object.entries(currentQuestion.options).map(([key, value]) => (
                        <motion.button
                          key={key}
                          onClick={() => handleAnswerSelect(currentQuestion.id, key)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className={`w-full p-4 rounded-lg text-left font-semibold text-gray-700 transition-all duration-200 shadow-md border-2
                            ${answers[currentQuestion.id] === key
                              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white border-green-600'
                              : 'bg-white/80 hover:bg-indigo-50 border-transparent'}`
                          }
                        >
                          <span className="font-bold mr-2">{key.toUpperCase()}.</span> {value}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                 {currentQuestionIndex === questions.length - 1 && (
                    <motion.div initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: 0.5}} className="mt-6 w-full">
                        <Button
                        onClick={() => handleSubmit(answers)}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-lg shadow-xl text-lg"
                        >
                        {submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-2 h-6 w-6" />}
                        Finish & Submit
                        </Button>
                    </motion.div>
                )}
            </div>
        )
    }
  }, [quizSchedule, questions, quizState, timeLeft, currentQuestionIndex, answers, handleSubmit, submitting]);

  return (
    <div className="min-h-screen flex flex-col p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {content}
      </div>
    </div>
  );
};

export default Quiz;