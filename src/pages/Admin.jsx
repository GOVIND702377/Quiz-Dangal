import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Clock, Users, Trophy, Settings, Copy, Database, HelpCircle } from 'lucide-react';

export default function Admin() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [showSQLCommands, setShowSQLCommands] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState('');

  // Quiz form state
  const [quizForm, setQuizForm] = useState({
    title: '',
    entry_fee: '',
    prizes: ['', '', ''],
    start_time: '',
    end_time: '',
    result_time: '',
    category: ''
  });

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    options: ['', '', '', '']
  });

  useEffect(() => {
    // Always fetch quizzes for testing
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch quizzes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      const prizesArray = quizForm.prizes.filter(p => p).map(p => parseInt(p));
      const prizePool = prizesArray.reduce((sum, prize) => sum + prize, 0);

      const { data, error } = await supabase
        .from('quizzes')
        .insert([{
          title: quizForm.title,
          entry_fee: parseFloat(quizForm.entry_fee),
          prize_pool: prizePool,
          prizes: prizesArray,
          start_time: quizForm.start_time,
          end_time: quizForm.end_time,
          result_time: quizForm.result_time,
          status: 'upcoming',
          category: quizForm.category || null
        }])
        .select();

      if (error) throw error;

      const newQuizId = data[0].id;
      
      // Generate SQL commands for questions
      generateSQLCommands(newQuizId, quizForm.title);

      toast({
        title: "Success",
        description: "Quiz created successfully! Check SQL commands to add questions.",
      });

      setShowCreateQuiz(false);
      setShowSQLCommands(true);
      setQuizForm({
        title: '',
        entry_fee: '',
        prizes: ['', '', ''],
        start_time: '',
        end_time: '',
        result_time: ''
      });
      fetchQuizzes();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const generateSQLCommands = (quizId, quizTitle) => {
    const sql = `-- SQL Commands for Quiz: ${quizTitle}
-- Quiz ID: ${quizId}

-- Step 1: Add Questions
INSERT INTO questions (quiz_id, question_text) VALUES
('${quizId}', 'Your question 1 here?'),
('${quizId}', 'Your question 2 here?'),
('${quizId}', 'Your question 3 here?'),
('${quizId}', 'Your question 4 here?'),
('${quizId}', 'Your question 5 here?');

-- Step 2: Get Question IDs
SELECT id, question_text FROM questions WHERE quiz_id = '${quizId}';

-- Step 3: Add Options (Replace QUESTION_ID_X with actual IDs from Step 2)
INSERT INTO options (question_id, option_text) VALUES
-- For Question 1
('QUESTION_ID_1', 'Option A'),
('QUESTION_ID_1', 'Option B'),
('QUESTION_ID_1', 'Option C'),
('QUESTION_ID_1', 'Option D'),

-- For Question 2
('QUESTION_ID_2', 'Option A'),
('QUESTION_ID_2', 'Option B'),
('QUESTION_ID_2', 'Option C'),
('QUESTION_ID_2', 'Option D');

-- Continue for all questions...

-- Step 4: Verify Setup
SELECT 
  q.question_text,
  array_agg(o.option_text ORDER BY o.id) as options
FROM questions q
LEFT JOIN options o ON q.id = o.question_id
WHERE q.quiz_id = '${quizId}'
GROUP BY q.id, q.question_text
ORDER BY q.id;`;

    setGeneratedSQL(sql);
  };

  const fetchQuestions = async (quizId) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          options (
            id,
            option_text
          )
        `)
        .eq('quiz_id', quizId);

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch questions.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "SQL commands copied to clipboard.",
    });
  };

  const deleteQuiz = async (quizId) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Quiz deleted successfully!",
      });
      fetchQuizzes();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Temporary: Allow admin access for testing
  // if (userProfile?.role !== 'admin') {
  //   return (
  //     <div className="container mx-auto px-4 py-8 text-center">
  //       <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
  //       <p className="text-gray-600 mt-2">You don't have admin privileges.</p>
  //     </div>
  //   );
  // }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Quiz Dangal Admin
        </h1>
        <p className="text-gray-600">Manage quizzes, questions, and prizes</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">{quizzes.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Active Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">
                {quizzes.filter(q => q.status === 'active').length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Upcoming Quizzes</p>
              <p className="text-2xl font-bold text-gray-800">
                {quizzes.filter(q => q.status === 'upcoming').length}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Create Quiz Button */}
      <div className="mb-6">
        <Button
          onClick={() => setShowCreateQuiz(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Quiz
        </Button>
      </div>

      {/* Create Quiz Form */}
      {showCreateQuiz && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg mb-8"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Quiz</h2>
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Quiz Title</Label>
                <Input
                  id="title"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({...quizForm, title: e.target.value})}
                  placeholder="Daily Opinion Quiz - Evening"
                  required
                />
              </div>
              <div>
                <Label htmlFor="entry_fee">Entry Fee (₹)</Label>
                <Input
                  id="entry_fee"
                  type="number"
                  step="0.01"
                  value={quizForm.entry_fee}
                  onChange={(e) => setQuizForm({...quizForm, entry_fee: e.target.value})}
                  placeholder="11.00"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Prize Distribution (₹)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="1st Prize (251)"
                  value={quizForm.prizes[0]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[0] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
                <Input
                  placeholder="2nd Prize (151)"
                  value={quizForm.prizes[1]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[1] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
                <Input
                  placeholder="3rd Prize (51)"
                  value={quizForm.prizes[2]}
                  onChange={(e) => {
                    const newPrizes = [...quizForm.prizes];
                    newPrizes[2] = e.target.value;
                    setQuizForm({...quizForm, prizes: newPrizes});
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={quizForm.start_time}
                  onChange={(e) => setQuizForm({...quizForm, start_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={quizForm.end_time}
                  onChange={(e) => setQuizForm({...quizForm, end_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="result_time">Result Time</Label>
                <Input
                  id="result_time"
                  type="datetime-local"
                  value={quizForm.result_time}
                  onChange={(e) => setQuizForm({...quizForm, result_time: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={quizForm.category}
                  onChange={(e) => setQuizForm({ ...quizForm, category: e.target.value })}
                  placeholder="e.g., GK, Sports, Movies, Opinion"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Create Quiz & Generate SQL
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateQuiz(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* SQL Commands Display */}
      {showSQLCommands && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 text-green-400 rounded-2xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Database className="mr-2" />
              SQL Commands to Run in Supabase
            </h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => copyToClipboard(generatedSQL)}
                variant="outline"
                size="sm"
                className="text-green-400 border-green-400"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button
                onClick={() => setShowSQLCommands(false)}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-400"
              >
                Close
              </Button>
            </div>
          </div>
          <pre className="bg-black p-4 rounded-lg overflow-x-auto text-sm">
            <code>{generatedSQL}</code>
          </pre>
          <div className="mt-4 p-4 bg-yellow-900/50 rounded-lg">
            <h3 className="font-bold text-yellow-400 mb-2 flex items-center">
              <HelpCircle className="mr-2 h-4 w-4" />
              Instructions:
            </h3>
            <ol className="list-decimal list-inside text-yellow-200 space-y-1 text-sm">
              <li>Copy the SQL commands above</li>
              <li>Go to Supabase Dashboard → SQL Editor</li>
              <li>Paste and run Step 1 (Add Questions)</li>
              <li>Run Step 2 to get Question IDs</li>
              <li>Replace QUESTION_ID_X with actual IDs in Step 3</li>
              <li>Run Step 3 to add options</li>
              <li>Run Step 4 to verify everything is set up</li>
            </ol>
          </div>
        </motion.div>
      )}

      {/* Quizzes List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800">All Quizzes</h2>
        {quizzes.map((quiz, index) => (
          <motion.div
            key={quiz.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">{quiz.title}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>Entry: ₹{quiz.entry_fee}</span>
                  <span>Prize Pool: ₹{quiz.prize_pool}</span>
                  <span>Prizes: ₹{quiz.prizes?.join(', ₹')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    quiz.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    quiz.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {quiz.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  <span>Start: {new Date(quiz.start_time).toLocaleString()}</span>
                  <span className="ml-4">End: {new Date(quiz.end_time).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedQuiz(quiz);
                    fetchQuestions(quiz.id);
                    setShowQuestions(true);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Settings className="h-4 w-4" />
                  Questions
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    generateSQLCommands(quiz.id, quiz.title);
                    setShowSQLCommands(true);
                  }}
                  className="text-green-600 hover:text-green-700"
                >
                  <Database className="h-4 w-4" />
                  SQL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteQuiz(quiz.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
