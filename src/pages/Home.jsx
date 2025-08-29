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
  {label}: {String(timeLeft.minutes ?? 0).padStart(2, '0')}:{String(timeLeft.seconds ?? 0).padStart(2, '0')}
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
  // Top-3 and streak removed
  const categories = ['All', 'GK', 'Sports', 'Opinion', 'Movies'];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchQuizzesAndCounts = useCallback(async () => {
    console.log('Fetching quizzes...');
    try {
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('*')
        // For testing - show all quizzes regardless of time
        // .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      console.log('Quiz data received:', quizzesData);
      console.log('Quiz error:', error);

      if (error) throw error;
      setQuizzes(quizzesData || []);
      console.log('Quizzes set to state:', quizzesData?.length || 0);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      toast({ title: "Error", description: "Could not fetch quizzes.", variant: "destructive" });
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
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
      try {
        // Prefer server-side count to avoid RLS recursion
        const { data, error } = await supabase.rpc('get_participant_count', { p_quiz_id: quizId });
        if (!error && Number.isInteger(data)) {
          setParticipantCounts(prev => ({...prev, [quizId]: data}));
          return;
        }
      } catch {}
      // Fallback to client-side head count if RPC unavailable
      const { count, error } = await supabase
        .from('quiz_participants')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .eq('status', 'joined');
      if (!error) {
        setParticipantCounts(prev => ({...prev, [quizId]: count || 0}));
      }
  }

  useEffect(() => {
      if(quizzes.length > 0) {
          quizzes.forEach(q => updateParticipantCount(q.id));
      }
  }, [quizzes]);

  // Streak logic removed

  const handleJoinQuiz = async (quiz) => {
    try {
      // 1) Try server-side RPC for atomic/idempotent join (if configured in DB)
      const tries = [
        () => supabase.rpc('join_quiz', { p_quiz_id: quiz.id, p_user_id: user.id }),
        () => supabase.rpc('join_quiz', { quiz_id: quiz.id, user_id: user.id }),
      ];
      let rpcJoined = false;
      for (const t of tries) {
        const { error } = await t();
        if (!error) { rpcJoined = true; break; }
      }

      // 2) Fallback: client-side idempotent join
      if (!rpcJoined) {
        const { data: existingParticipant, error: checkError } = await supabase
          .from('quiz_participants')
          .select('quiz_id')
          .eq('quiz_id', quiz.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (checkError) throw checkError;
        if (!existingParticipant) {
          const { error: insError } = await supabase
            .from('quiz_participants')
            .insert([{ quiz_id: quiz.id, user_id: user.id, status: 'joined' }]);
          if (insError) throw insError;
        }
      }

      toast({ title: "Joined!", description: "Redirecting you to the quiz." });
      navigate(`/quiz/${quiz.id}`);
    } catch (err) {
      console.error("Error joining quiz:", err);
      toast({ title: "Error", description: err.message || "Could not join quiz.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 space-y-6">
       <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-6"
      >
        <div className="flex justify-center mb-3">
          <img 
            src="/android-chrome-512x512.png" 
            alt="Quiz Dangal Logo" 
            className="w-16 h-16 rounded-full shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">Today's Quizzes</h1>
        <p className="text-gray-600">Quizzes for every mood ~ Prizes for every win</p>
      </motion.div>

      {/* Category filters */}
      <div className="flex items-center justify-center gap-2 flex-nowrap overflow-x-auto -mt-4">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              selectedCategory === c
                ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {/* Weekly / Monthly Top-3 removed per request */}

      {loading ? (
        <div className="text-center py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="ml-2">Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-8 bg-white/50 rounded-2xl shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800">No quizzes available</h3>
          <p className="text-gray-600 mt-2">Create a quiz from admin panel to get started!</p>
          <button 
            onClick={fetchQuizzesAndCounts}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Quizzes
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {(
            selectedCategory === 'All' ? quizzes : quizzes.filter(q => (q.category || '').toLowerCase() === selectedCategory.toLowerCase())
          ).map((quiz, index) => {
            console.log('Rendering quiz:', quiz.title);
            // For testing - always allow joining
            const canJoin = true;
            // const now = new Date();
            // const startTime = new Date(quiz.start_time);
            // const canJoin = now < startTime;

            return (
              <motion.div
                key={quiz.id}
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
                    {participantCounts[quiz.id] || 0} joined
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
                  <><Play className="mr-2" />Join For FREE (Testing)</>
                </Button>
              </motion.div>
            )
          })}
        </div>
      )}

  {/* How It Works section removed per request */}
    </div>
  );
};

export default Home;