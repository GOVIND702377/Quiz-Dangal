import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Star, Gift, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const CountdownTimer = ({ targetTime, onEnd, label }) => {
  const calculateTimeLeft = useCallback(() => {
    const difference = +new Date(targetTime) - +new Date();
    let timeLeft = {};
    if (difference > 0) {
      timeLeft = {
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  }, [targetTime]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (!newTimeLeft.minutes && !newTimeLeft.seconds) {
        onEnd();
      }
    }, 1000);

    return () => clearTimeout(timer);
  });

  return (
    <span className="font-mono">
      {label}: {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
    </span>
  );
};

const Home = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantCounts, setParticipantCounts] = useState({});

  const fetchQuizzesAndCounts = useCallback(async () => {
    let scheduleData = [];
    let scheduleError = null;
    try {
      const res = await supabase
  .from('quizzes')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });
      scheduleData = res.data || [];
      scheduleError = res.error;
    } catch (err) {
      scheduleError = err;
      scheduleData = [];
    }
    if (scheduleError) {
      if (scheduleError.code === '42P01' || (scheduleError.message && scheduleError.message.includes('quiz_schedule'))) {
        // Table does not exist
        setQuizzes([]);
      } else {
        console.error('Error fetching quizzes:', scheduleError);
        toast({ title: "Error", description: "Could not fetch quizzes.", variant: "destructive" });
      }
    } else {
      setQuizzes(scheduleData);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchQuizzesAndCounts();
    const interval = setInterval(fetchQuizzesAndCounts, 30000); // Refresh every 30 seconds

    const participantChannel = supabase
      .channel('quiz-participants-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_participants' },
        (payload) => {
          // Refetch counts when participants change
          const quizId = payload.new.quiz_id || payload.old.quiz_id;
          if(quizId) {
             updateParticipantCount(quizId);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(participantChannel);
    };
  }, [fetchQuizzesAndCounts]);

  const updateParticipantCount = async (quizId) => {
      const { count, error } = await supabase
        .from('quiz_participants')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .eq('status', 'joined');
      
      if (!error) {
        setParticipantCounts(prev => ({...prev, [quizId]: count}));
      }
  }

  useEffect(() => {
      if(quizzes.length > 0) {
          quizzes.forEach(q => updateParticipantCount(q.quiz_id));
      }
  }, [quizzes]);

  const handleJoinQuiz = async (quiz) => {
    const now = new Date();
    if (now >= new Date(quiz.start_time)) {
      toast({ title: "Quiz already started", description: "You can no longer join this quiz.", variant: "destructive" });
      return;
    }

    try {
      // Check if user has already joined
      const { data: existingParticipant, error: checkError } = await supabase
        .from('quiz_participants')
        .select('quiz_id')
        .eq('quiz_id', quiz.quiz_id)
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle() to avoid error when no rows are found
      
      if (checkError) {
          throw checkError;
      }
      
      if (existingParticipant) {
          toast({
            title: "Already Joined!",
            description: "Redirecting you to the quiz.",
          });
          navigate(`/quiz/${quiz.quiz_id}`);
          return;
      }

      const { error } = await supabase
        .from('quiz_participants')
        .insert([{ quiz_id: quiz.quiz_id, user_id: user.id, status: 'joined' }]);

      if (error) {
        throw error;
      }

      toast({
        title: "Free Entry Granted!",
        description: "Aapko ek baar ke liye free entry mili hai. Agli baar se entry fee lagegi.",
      });
      navigate(`/quiz/${quiz.quiz_id}`);

    } catch(err) {
      console.error("Error joining quiz:", err);
      toast({ title: "Error", description: err.message || "Could not join quiz.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
       <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="flex justify-center mb-4">
          <img 
            src="/android-chrome-512x512.png" 
            alt="Quiz Dangal Logo" 
            className="w-16 h-16 rounded-full shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Today's Quizzes</h1>
        <p className="text-gray-600">Join opinion-based quizzes and win amazing prizes!</p>
      </motion.div>

      {loading ? (
        <div className="text-center py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-8 bg-white/50 rounded-2xl shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800">No upcoming quizzes</h3>
          <p className="text-gray-600 mt-2">Please check back later for new quizzes!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {quizzes.map((quiz, index) => {
            const now = new Date();
            const startTime = new Date(quiz.start_time);
            const canJoin = now < startTime;

            return (
              <motion.div
                key={quiz.quiz_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                      <Clock size={16} className="inline mr-1" />
                      {new Date(quiz.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Users size={16} className="mr-1" />
                    {participantCounts[quiz.quiz_id] || 0} joined
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {quiz.title}
                  </h3>
                   {canJoin && (
                     <p className="text-sm text-indigo-600">
                       <CountdownTimer targetTime={quiz.start_time} onEnd={fetchQuizzesAndCounts} label="Starts in" />
                     </p>
                   )}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex space-x-2">
                     {quiz.prizes?.map((prize, idx) => (
                      <div key={idx} className="bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                        <Gift size={14} className="inline mr-1" />
                        ₹{prize}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center text-yellow-600">
                    <Star size={16} className="mr-1" />
                    <span className="text-sm font-medium">Hot Quiz!</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleJoinQuiz(quiz)}
                  disabled={!canJoin}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                >
                  {canJoin ? <><Play className="mr-2" />Join For FREE</> : 'Quiz Started'}
                </Button>
              </motion.div>
            )
          })}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg"
      >
        <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <div className="text-2xl mb-2">🎯</div>
            <p>Answer 10 opinion-based questions</p>
          </div>
          <div>
            <div className="text-2xl mb-2">👥</div>
            <p>Majority vote determines correct answers</p>
          </div>
          <div>
            <div className="text-2xl mb-2">🏆</div>
            <p>Win prizes based on correct answers</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Home;