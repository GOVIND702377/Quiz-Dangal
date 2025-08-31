import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, Star, Gift, Loader2, Play, Brain, Trophy, Film, MessageSquare, ChevronDown, RefreshCw } from 'lucide-react';
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

const richCategories = [
  {
    name: 'General Knowledge',
    slug: 'gk',
    description: 'Test your knowledge on a wide range of topics.',
    icon: Brain,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Sports',
    slug: 'sports',
    description: 'How well do you know the world of sports?',
    icon: Trophy,
    color: 'from-orange-500 to-yellow-500',
  },
  {
    name: 'Movies',
    slug: 'movies',
    description: 'All about cinema, actors, and blockbusters.',
    icon: Film,
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Opinion',
    slug: 'opinion',
    description: 'Share your take on trending topics and events.',
    icon: MessageSquare,
    color: 'from-green-500 to-teal-500',
  },
];

const QuizCard = ({ quiz, onJoinQuiz, participantCounts, onEnd }) => {
  const canJoin = true; // For testing - always allow joining

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white/90 backdrop-blur-md border border-gray-200/50 rounded-xl p-4 shadow-md"
    >
      <div className="flex items-center justify-between mb-3">
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

      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{quiz.title}</h3>
        {canJoin && (
          <p className="text-sm text-indigo-600">
            <CountdownTimer targetTime={quiz.start_time} onEnd={onEnd} label="Starts in" />
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
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
        onClick={() => onJoinQuiz(quiz)}
        disabled={!canJoin}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
      >
        <Play className="mr-2" />Join For FREE (Testing)
      </Button>
    </motion.div>
  );
};

const CategoryCard = ({ category, quizzes, onJoinQuiz, participantCounts, onEnd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const categoryQuizzes = quizzes.filter(q => (q.category || '').toLowerCase() === category.slug.toLowerCase());

  return (
    <motion.div layout className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-lg overflow-hidden">
      <button
        className="w-full p-6 text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center text-white shadow-md`}>
            <category.icon size={28} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{category.name}</h3>
            <p className="text-sm text-gray-600">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{categoryQuizzes.length} Quizzes</span>
           <ChevronDown className={`w-6 h-6 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-6 pt-2"
          >
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {categoryQuizzes.length > 0 ? (
                categoryQuizzes.map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} onJoinQuiz={onJoinQuiz} participantCounts={participantCounts} onEnd={onEnd} />
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No quizzes available in this category right now.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Home = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantCounts, setParticipantCounts] = useState({});

  // New: Check if any quizzes have a valid category
  const quizzesWithCategories = quizzes.filter(quiz => 
    richCategories.some(cat => (quiz.category || '').toLowerCase() === cat.slug.toLowerCase())
  );


  const fetchQuizzesAndCounts = useCallback(async () => {
    console.log('Fetching quizzes...');
    try {
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setQuizzes(quizzesData || []);
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

      {loading ? (
        <div className="text-center py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="ml-2">Loading quizzes...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {richCategories.map((category, index) => (
            <motion.div
              key={category.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <CategoryCard 
                category={category}
                quizzes={quizzes}
                onJoinQuiz={handleJoinQuiz}
                participantCounts={participantCounts}
                onEnd={fetchQuizzesAndCounts}
              />
            </motion.div>
          ))}
          {quizzes.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 bg-white/50 rounded-2xl shadow-md p-6"
            >
              <h3 className="text-xl font-semibold text-gray-800">No Quizzes Available Right Now</h3>
              <p className="text-gray-600 mt-2">Check back later for new quizzes, or create one from the admin panel.</p>
              <Button onClick={fetchQuizzesAndCounts} className="mt-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Quizzes
              </Button>
            </motion.div>
          )}
          {quizzes.length > 0 && quizzesWithCategories.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 bg-yellow-50/80 border border-yellow-200 rounded-2xl shadow-md p-6"
            >
              <h3 className="text-xl font-semibold text-yellow-800">No Quizzes in Categories</h3>
              <p className="text-gray-600 mt-2">
                It looks like you have quizzes, but none of them have a matching category (like 'gk', 'sports', etc.).
              </p>
              <p className="text-gray-600 mt-1">Please update your quizzes in the Supabase table editor.</p>
            </motion.div>
          )}
        </div>
      )}

    </div>
  );
};

export default Home;