import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trophy, Medal, Award, Users, Clock } from 'lucide-react';

const Results = () => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [quizId]);

  const fetchResults = async () => {
    try {
      // Get quiz details
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();
      
      setQuiz(quizData);

      // Get participants with scores
      const { data: participants } = await supabase
        .from('quiz_participants')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .eq('quiz_id', quizId)
        .eq('status', 'completed')
        .order('score', { ascending: false });

      setResults(participants || []);
      
      // Find user's rank
      const userResult = participants?.find(p => p.user_id === user.id);
      if (userResult) {
        const rank = participants.findIndex(p => p.user_id === user.id) + 1;
        setUserRank({ ...userResult, rank });
      }

    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Quiz Results
          </h1>
          <p className="text-gray-600">{quiz?.title}</p>
        </motion.div>

        <div className="flex justify-center gap-3 mb-8">
          <Button variant="outline" onClick={() => navigate('/my-quizzes')}>Back to My Quizzes</Button>
          <Button onClick={async () => {
            try {
              const url = window.location.href;
              if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                toast({ title: 'Link copied', description: 'Result link copied to clipboard' });
              } else {
                window.prompt('Copy result link:', url);
              }
            } catch (e) {
              toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
            }
          }}>Share Result</Button>
        </div>

        {/* User's Result */}
        {userRank && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg mb-8"
          >
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                {userRank.rank === 1 ? (
                  <Trophy className="h-16 w-16 text-yellow-500" />
                ) : userRank.rank === 2 ? (
                  <Medal className="h-16 w-16 text-gray-400" />
                ) : userRank.rank === 3 ? (
                  <Award className="h-16 w-16 text-orange-500" />
                ) : (
                  <Users className="h-16 w-16 text-blue-500" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Your Result
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-indigo-600">#{userRank.rank}</p>
                  <p className="text-sm text-gray-600">Rank</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">{userRank.score}</p>
                  <p className="text-sm text-gray-600">Score</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    ₹{userRank.rank <= 3 ? quiz?.prizes?.[userRank.rank - 1] || 0 : 0}
                  </p>
                  <p className="text-sm text-gray-600">Prize</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Prize Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg mb-6"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">Prize Distribution</h2>
          {Array.isArray(quiz?.prizes) && quiz.prizes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {quiz.prizes.map((amount, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-gray-50 flex items-center justify-between">
                  <div className="font-medium text-gray-700">{idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx+1}`}</div>
                  <div className="text-indigo-600 font-bold">₹{amount}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No prize data available</div>
          )}
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Trophy className="mr-2 text-yellow-500" />
            Leaderboard
          </h2>
          
          <div className="space-y-4">
            {results.map((participant, index) => (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  participant.user_id === user.id 
                    ? 'bg-indigo-100 border-2 border-indigo-300' 
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {participant.profiles?.full_name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {participant.profiles?.email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{participant.score}</p>
                    <p className="text-xs text-gray-600">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">
                      ₹{index < 3 ? quiz?.prizes?.[index] || 0 : 0}
                    </p>
                    <p className="text-xs text-gray-600">Prize</p>
                  </div>
                  {index < 3 && (
                    <div className="text-2xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;