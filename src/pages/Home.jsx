import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Play, Brain, Trophy, Film, MessageSquare, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';





const richCategories = [
  {
    name: 'G.Knowlage',
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





const CategoryCard = ({ category, quizzes, onJoinQuiz, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const categoryQuizzes = quizzes.filter(q => (q.category || '').toLowerCase() === category.slug.toLowerCase());

  const handlePlayClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);
    onJoinQuiz(categoryQuizzes[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.1
      }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative w-full"
    >
      {/* Glassmorphism Card */}
      <div className="relative bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 overflow-hidden">
        {/* Animated Background Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-5 group-hover:opacity-10 transition-opacity duration-200`} />
        
        {/* Floating Particles */}
        <div className="absolute top-4 right-4 w-2 h-2 bg-white/40 rounded-full animate-pulse" />
        <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
        
        {/* Glow Effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-200`} />
        
        <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-3">
          {/* Left - Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Animated Icon */}
            <motion.div 
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center text-white shadow-xl flex-shrink-0`}
              animate={{ 
                rotate: isHovered ? [0, -5, 5, 0] : 0,
                scale: isHovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {/* Icon Glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${category.color} blur-lg opacity-50 animate-pulse`} />
              <category.icon size={20} className="relative z-10 drop-shadow-lg" />
              
              {/* Sparkle Effect */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="absolute -top-1 -right-1"
                  >
                    <Sparkles className="w-3 h-3 text-yellow-300 animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            
            <div className="min-w-0 flex-1">
              <motion.h3 
                className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-1"
                animate={{ x: isHovered ? 5 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {category.name}
              </motion.h3>
              <motion.p 
                className="text-xs sm:text-sm text-gray-600/80 leading-relaxed"
                animate={{ x: isHovered ? 5 : 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {category.description}
              </motion.p>
            </div>
          </div>
          
          {/* Right - Animated Play Button */}
          <div className="flex-shrink-0">
            <motion.button
              onClick={handlePlayClick}
              disabled={!categoryQuizzes[0]}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ 
                scale: isPressed ? [1, 1.2, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
              className={`relative px-4 py-2 sm:px-5 sm:py-3 rounded-full font-bold text-white shadow-xl transition-all duration-300 flex items-center gap-2 overflow-hidden ${!categoryQuizzes[0] ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl'}`}
            >
              {/* Animated Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-r ${category.color} animate-gradient-x`} />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 hover:opacity-100 transition-opacity duration-500 animate-gradient-x" />
              
              {/* Button Content */}
              <motion.div
                animate={{ rotate: isHovered ? 360 : 0 }}
                transition={{ duration: 0.3 }}
                className="relative z-10"
              >
                <Play className="w-4 h-4 drop-shadow-lg" />
              </motion.div>
              <span className="relative z-10 text-xs sm:text-sm font-extrabold tracking-wide drop-shadow-lg">
                Play Now
              </span>
              
              {/* Pulse Effect */}
              <AnimatePresence>
                {isPressed && (
                  <motion.div
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 rounded-full bg-gradient-to-r ${category.color}`}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Home = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const quizzesWithCategories = quizzes.filter(quiz => 
    richCategories.some(cat => (quiz.category || '').toLowerCase() === cat.slug.toLowerCase())
  );

  const fetchQuizzesAndCounts = useCallback(async () => {
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
    const interval = setInterval(fetchQuizzesAndCounts, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchQuizzesAndCounts]);



  const handleJoinQuiz = async (quiz) => {
    try {
      const tries = [
        () => supabase.rpc('join_quiz', { p_quiz_id: quiz.id, p_user_id: user.id }),
        () => supabase.rpc('join_quiz', { quiz_id: quiz.id, user_id: user.id }),
      ];
      let rpcJoined = false;
      for (const t of tries) {
        const { error } = await t();
        if (!error) { rpcJoined = true; break; }
      }

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
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Simple Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Simple Header */}
        <div className="text-center mb-6 sm:mb-8 relative">
          {/* Simple Logo */}
          <div className="flex justify-center mb-6">
            <img src="/android-chrome-512x512.png" alt="Quiz Dangal Logo" className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl shadow-lg" />
          </div>
          
          {/* Simple Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight">
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              Today's Quizzes
            </span>
          </h1>
          
          {/* Simple Subtitle */}
          <p className="text-base sm:text-xl text-gray-600 font-medium px-4 sm:px-0 mb-6">
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-semibold">Quizzes for every mood</span>
            <span className="mx-3 text-gray-400">✨</span>
            <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent font-semibold">Prizes for every win</span>
          </p>
        </div>

      {loading ? (
        <motion.div 
          className="w-full text-center py-16 bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-center items-center mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-purple-500" />
            </motion.div>
          </div>
          
          {/* Loading Animation Dots */}
          <div className="flex justify-center space-x-2 mb-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
          
          <p className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Loading amazing quizzes...</p>
          <p className="text-sm text-gray-600 mt-2">Preparing your next challenge</p>
        </motion.div>
      ) : (
        <div className="w-full space-y-3 sm:space-y-4">
          {richCategories.map((category, index) => (
            <CategoryCard 
              key={category.slug}
              category={category}
              quizzes={quizzes}
              onJoinQuiz={handleJoinQuiz}
              index={index}
            />
          ))}

          {quizzes.length > 0 && quizzesWithCategories.length === 0 && (
            <motion.div 
              className="w-full text-center py-16 bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center text-white shadow-2xl"
                animate={{ 
                  rotate: [0, -10, 10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
              >
                <MessageSquare size={36} />
              </motion.div>
              
              <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-4">No Quizzes in Categories</h3>
              <div className="max-w-md mx-auto space-y-3 px-4">
                <p className="text-gray-700 font-medium">No quizzes match our categories!</p>
                <p className="text-gray-600 text-sm">Categories needed: 'gk', 'sports', 'movies', 'opinion'</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default Home;
