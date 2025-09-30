import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Settings, Loader2, ShieldCheck, RefreshCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

function AdminNotificationsSection() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('announcement');
  const [quizId, setQuizId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  // Push notifications state
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [sendingPush, setSendingPush] = useState(false);

  const loadRecent = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
    } else {
      setRecent(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadRecent(); }, []);

  const handleSendPushNotification = async (e) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      toast({ title: 'Title/Message required', variant: 'destructive' });
      return;
    }
    setSendingPush(true);
    try {
      const { error } = await supabase.functions.invoke('send-notifications', {
        body: { title: pushTitle.trim(), message: pushMessage.trim() },
      });
      if (error) throw error;
      toast({ title: 'Push sent', description: 'Notifications queued to subscribers.' });
      setPushTitle('');
      setPushMessage('');
    } catch (err) {
      toast({ title: 'Push failed', description: err.message || 'Try again later', variant: 'destructive' });
    } finally {
      setSendingPush(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Title/Message required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const payload = {
        p_title: title.trim(),
        p_message: message.trim(),
        p_type: type,
        p_quiz_id: quizId ? quizId : null,
        p_scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      const { error } = await supabase.rpc('create_notification', payload);
      if (error) throw error;
      toast({ title: 'Notification queued', description: 'It will be delivered per schedule.' });
      setTitle(''); setMessage(''); setQuizId(''); setScheduledAt(''); setType('announcement');
      await loadRecent();
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <ShieldCheck className="mr-2" /> Admin: Notifications
          </h2>
          <p className="text-gray-600 text-sm">Announcements aur quiz notifications yahan se bhejein</p>
        </div>
      </div>

      {/* New section for sending Push Notifications */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Send Push Notification</h3>
        <form onSubmit={handleSendPushNotification} className="space-y-3">
          <div>
            <Label htmlFor="pushTitle">Push Notification Title *</Label>
            <Input id="pushTitle" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="e.g., New Quiz Alert!" required />
          </div>
          <div>
            <Label htmlFor="pushMessage">Push Notification Message *</Label>
            <Textarea id="pushMessage" value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} placeholder="Don't miss out on today's quiz!" required />
          </div>
          <Button type="submit" disabled={sendingPush} className="bg-purple-600 hover:bg-purple-700">
            {sendingPush ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Sending Push...</>) : 'Send Push Notification'}
          </Button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ntitle">Title *</Label>
              <Input id="ntitle" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g., Quiz Starting Soon" required />
            </div>
            <div>
              <Label htmlFor="ntype">Type *</Label>
              <select id="ntype" value={type} onChange={(e)=>setType(e.target.value)} className="w-full border rounded-md px-3 py-2">
                <option value="announcement">Announcement</option>
                <option value="quiz_start">Quiz Start</option>
                <option value="quiz_end">Quiz End</option>
                <option value="quiz_result">Quiz Result</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="nmsg">Message *</Label>
            <Textarea id="nmsg" value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Write your message..." required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nquiz">Quiz ID (optional)</Label>
              <Input id="nquiz" value={quizId} onChange={(e)=>setQuizId(e.target.value)} placeholder="UUID of quiz" />
            </div>
            <div>
              <Label htmlFor="nsched">Schedule (optional)</Label>
              <Input id="nsched" type="datetime-local" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={sending} className="bg-indigo-600 hover:bg-indigo-700">
              {sending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Sending...</>) : 'Send Notification'}
            </Button>
            <Button type="button" variant="outline" onClick={loadRecent}>Refresh</Button>
          </div>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-gray-800 mb-3">Recent</h3>
        {loading ? (
          <div className="py-8 text-center text-gray-600"><Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2"/> Loading...</div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-gray-600">No notifications</div>
        ) : (
          <div className="space-y-2">
            {recent.map((n)=> (
              <div key={n.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-gray-800">{n.title} <span className="text-xs text-gray-500">({n.type})</span></div>
                  <div className="text-gray-600">{n.message}</div>
                  <div className="text-gray-500 text-xs">Quiz: {n.quiz_id || '—'} • Scheduled: {n.scheduled_at ? new Date(n.scheduled_at).toLocaleString() : 'now'} • Created: {new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'overview';
  const setTab = (key) => { const p = new URLSearchParams(params); p.set('tab', key); setParams(p, { replace: false }); };

  // Admin-only gate
  if (userProfile?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">Aapke paas admin adhikaar nahi hain.</p>
      </div>
    );
  }

  // Quizzes
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [busyQuizId, setBusyQuizId] = useState(null);
  const categories = ['opinion', 'gk', 'movies', 'sports'];

  // Removed translation trigger and auto-sync; no-op now

  const [quizForm, setQuizForm] = useState({
    title: '', prizes: ['', '', ''], start_time: '', end_time: '', result_time: '', category: ''
  });

  useEffect(() => { if (activeTab === 'overview') fetchQuizzes(); }, [activeTab]);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('start_time', { ascending: false });
      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch quizzes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (quizId) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`id, question_text, options ( id, option_text, is_correct )`)
        .eq('quiz_id', quizId);
      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch questions.', variant: 'destructive' });
    }
  };

  // Questions & Options CRUD
  const addQuestion = async () => {
    if (!selectedQuiz) return;
    const text = window.prompt('Question text daalein');
    if (!text || !text.trim()) return;
    const { error } = await supabase.from('questions').insert({ quiz_id: selectedQuiz.id, question_text: text.trim() });
    if (error) return toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const saveQuestion = async (qid, text) => {
    const t = (text || '').trim();
    if (!t) return toast({ title: 'Question khaali nahi ho sakta', variant: 'destructive' });
    const { error } = await supabase.from('questions').update({ question_text: t }).eq('id', qid);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const deleteQuestion = async (qid) => {
    if (!confirm('Is question aur iske options ko delete karein?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', qid);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const addOption = async (qid) => {
    const text = window.prompt('Option text daalein');
    if (!text || !text.trim()) return;
    const { error } = await supabase.from('options').insert({ question_id: qid, option_text: text.trim() });
    if (error) return toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const saveOption = async (oid, text) => {
    const t = (text || '').trim();
    if (!t) return toast({ title: 'Option khaali nahi ho sakta', variant: 'destructive' });
    const { error } = await supabase.from('options').update({ option_text: t }).eq('id', oid);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const deleteOption = async (oid) => {
    if (!confirm('Is option ko delete karein?')) return;
    const { error } = await supabase.from('options').delete().eq('id', oid);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
  await fetchQuestions(selectedQuiz.id);
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      const prizesArray = quizForm.prizes.filter(p => p).map(p => parseInt(p));
      const prizePool = prizesArray.reduce((sum, prize) => sum + prize, 0);

      const { data: insertData, error } = await supabase
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
        .select('id')
        .single();

      if (error) throw error;

      toast({ title: 'Success', description: 'Quiz create ho gaya.' });

      setShowCreateQuiz(false);
      setQuizForm({ title: '', entry_fee: '', prizes: ['', '', ''], start_time: '', end_time: '', result_time: '', category: '' });
      fetchQuizzes();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!confirm('Kya aap is quiz ko delete karna chahte hain?')) return;
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Quiz delete ho gaya.' });
      fetchQuizzes();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const recomputeResults = async (quizId) => {
    try {
      setBusyQuizId(quizId);
      const { error } = await supabase.rpc('admin_recompute_quiz_results', { p_quiz_id: quizId });
      if (error) throw error;
      toast({ title: 'Results recomputed', description: 'Leaderboard update ho gaya.' });
    } catch (error) {
      toast({ title: 'Recompute failed', description: error.message, variant: 'destructive' });
    } finally {
      setBusyQuizId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Quiz Dangal Admin</h1>
        <p className="text-gray-600">Admin dashboard</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { key: 'overview', title: 'Overview' },
          { key: 'notifications', title: 'Notifications' },
          { key: 'redemptions', title: 'Redemptions' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${t.key === activeTab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          >
            {t.title}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
        {/* Create Quiz Button */}
        <div className="mb-6">
          <Button onClick={() => setShowCreateQuiz(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create New Quiz
          </Button>
        </div>

        {/* Create Quiz Form */}
        {showCreateQuiz && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Create New Quiz</h2>
            {/* Note removed: translations no longer auto-generated */}
            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <Label>Category (Section)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setQuizForm({ ...quizForm, category: c })}
                      className={`px-3 py-1 rounded-full border text-sm capitalize ${quizForm.category === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {!quizForm.category && (
                  <p className="text-xs text-red-600 mt-1">Please choose a category</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Quiz Title</Label>
                  <Input id="title" value={quizForm.title} onChange={(e) => setQuizForm({...quizForm, title: e.target.value})} placeholder="Daily Opinion Quiz - Evening" required />
                </div>
              </div>

              <div>
                <Label>Prize Distribution (₹)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="1st Prize (251)" value={quizForm.prizes[0]} onChange={(e) => { const p=[...quizForm.prizes]; p[0]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                  <Input placeholder="2nd Prize (151)" value={quizForm.prizes[1]} onChange={(e) => { const p=[...quizForm.prizes]; p[1]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                  <Input placeholder="3rd Prize (51)" value={quizForm.prizes[2]} onChange={(e) => { const p=[...quizForm.prizes]; p[2]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input id="start_time" type="datetime-local" value={quizForm.start_time} onChange={(e) => setQuizForm({...quizForm, start_time: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input id="end_time" type="datetime-local" value={quizForm.end_time} onChange={(e) => setQuizForm({...quizForm, end_time: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="result_time">Result Time</Label>
                  <Input id="result_time" type="datetime-local" value={quizForm.result_time} onChange={(e) => setQuizForm({...quizForm, result_time: e.target.value})} required />
                </div>
              </div>

              <div className="flex space-x-4">
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Create Quiz</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateQuiz(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Quizzes List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">All Quizzes</h2>
          {loading ? (
            <div className="py-8 text-center text-gray-600">
              <Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2" /> Loading quizzes...
            </div>
          ) : quizzes.map((quiz, index) => (
            <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{quiz.title}</h3>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span>Category: {quiz.category || '—'}</span>
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
                  {/* Inline times/status editor */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                    <select className="border rounded-md px-2 py-2 capitalize" value={quiz.category || ''} onChange={async (e)=>{ const { error } = await supabase.from('quizzes').update({ category: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }}>
                      <option value="">Select category</option>
                      {categories.map(c => (<option value={c} key={c}>{c}</option>))}
                    </select>
                    <Input type="datetime-local" value={quiz.start_time?.slice(0,16) || ''} onChange={async (e)=>{ const { error } = await supabase.from('quizzes').update({ start_time: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }} />
                    <Input type="datetime-local" value={quiz.end_time?.slice(0,16) || ''} onChange={async (e)=>{ const { error } = await supabase.from('quizzes').update({ end_time: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }} />
                    <Input type="datetime-local" value={quiz.result_time?.slice(0,16) || ''} onChange={async (e)=>{ const { error } = await supabase.from('quizzes').update({ result_time: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }} />
                    <select className="border rounded-md px-2 py-2" value={quiz.status} onChange={async (e)=>{ const { error } = await supabase.from('quizzes').update({ status: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }}>
                      <option value="upcoming">upcoming</option>
                      <option value="active">active</option>
                      <option value="finished">finished</option>
                    </select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => recomputeResults(quiz.id)}
                    disabled={busyQuizId === quiz.id}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    {busyQuizId === quiz.id ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin"/>Recomputing</>
                    ) : (
                      <><RefreshCcw className="h-4 w-4 mr-1"/>Recompute</>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedQuiz(quiz); fetchQuestions(quiz.id); setShowQuestions(true); }} className="text-blue-600 hover:text-blue-700">
                    <Settings className="h-4 w-4" />
                    Questions
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteQuiz(quiz.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Questions Editor Panel */}
        {showQuestions && selectedQuiz && (
          <div className="mt-6 bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Questions for: {selectedQuiz.title}</h3>
              <div className="flex gap-2">
                <Button onClick={addQuestion} className="bg-indigo-600 hover:bg-indigo-700" size="sm"><Plus className="w-4 h-4 mr-1"/>Add Question</Button>
                <Button variant="outline" size="sm" onClick={()=>setShowQuestions(false)}>Close</Button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="py-6 text-center text-gray-600">No questions yet</div>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <Input defaultValue={q.question_text} onBlur={(e)=>saveQuestion(q.id, e.target.value)} className="flex-1" />
                      <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={()=>deleteQuestion(q.id)}><Trash2 className="w-4 h-4"/></Button>
                    </div>
                    <div className="mt-2 pl-1">
                      <div className="text-xs text-gray-500 mb-1">Options</div>
                      <div className="space-y-2">
                        {(q.options || []).map((o)=> (
                          <div key={o.id} className="flex items-center gap-2">
                            <Input defaultValue={o.option_text} onBlur={(e)=>saveOption(o.id, e.target.value)} className="flex-1" />
                            <label className="flex items-center gap-1 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                defaultChecked={!!o.is_correct}
                                onChange={async (e)=>{
                                  const { error } = await supabase.from('options').update({ is_correct: e.target.checked }).eq('id', o.id);
                                  if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' });
                                }}
                              />
                              Correct
                            </label>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={()=>deleteOption(o.id)}><Trash2 className="w-4 h-4"/></Button>
                          </div>
                        ))}
                        <Button onClick={()=>addOption(q.id)} size="sm" className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-1"/>Add Option</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </>
      )}

      {activeTab === 'notifications' && <AdminNotificationsSection />}

      {activeTab === 'redemptions' && <AdminRedemptionsSection />}
    </div>
  );
}

function AdminRedemptionsSection() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', coins_required: '', description: '', image_url: '' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reward_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setItems([]);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addItem = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const coins = parseInt(form.coins_required, 10);
    if (!title || isNaN(coins) || coins < 0) {
      toast({ title: 'Invalid input', description: 'Title required and coins must be a non-negative number', variant: 'destructive' });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('reward_catalog').insert({
      title: title,
      coins_required: coins,
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null,
      is_active: true,
    });
    if (error) toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Added', description: 'Catalog item created' });
      setForm({ title: '', coins_required: '', description: '', image_url: '' });
      load();
    }
    setAdding(false);
  };

  const saveInline = async (id, patch) => {
    const { error } = await supabase.from('reward_catalog').update(patch).eq('id', id);
    if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    else load();
  };

  const removeItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase.from('reward_catalog').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deleted' }); load(); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Admin: Redemptions Catalog</h2>
        <p className="text-gray-600 text-sm">Items jinko users coins se redeem kar sakte hain</p>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label htmlFor="rc_title">Title *</Label>
            <Input id="rc_title" value={form.title} onChange={(e)=>setForm({ ...form, title: e.target.value })} placeholder="e.g., ₹100 Paytm" required />
          </div>
          <div>
            <Label htmlFor="rc_coins">Coins *</Label>
            <Input id="rc_coins" type="number" min="0" value={form.coins_required} onChange={(e)=>setForm({ ...form, coins_required: e.target.value })} placeholder="e.g., 1000" required />
          </div>
          <div>
            <Label htmlFor="rc_img">Image URL (optional)</Label>
            <Input id="rc_img" value={form.image_url} onChange={(e)=>setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="rc_desc">Description (optional)</Label>
            <Textarea id="rc_desc" value={form.description} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Short details" />
          </div>
          <div>
            <Button type="submit" disabled={adding} className="bg-green-600 hover:bg-green-700">{adding ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Adding...</>) : 'Add Item'}</Button>
          </div>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-gray-800 mb-3">Catalog Items</h3>
        {loading ? (
          <div className="py-8 text-center text-gray-600"><Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2"/> Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-600">No items</div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="p-3 rounded-xl bg-white/70 border border-gray-200/50 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input defaultValue={it.title} onBlur={(e)=>{ const v=e.target.value.trim(); if (v && v !== it.title) saveInline(it.id, { title: v }); }} className="flex-1" />
                    <Input type="number" min="0" defaultValue={it.coins_required} onBlur={(e)=>{ const n=parseInt(e.target.value,10); if (!isNaN(n) && n !== it.coins_required) saveInline(it.id, { coins_required: n }); }} className="w-32" />
                  </div>
                  <div className="text-xs text-gray-600 mt-1 truncate">{it.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-700 flex items-center gap-1">
                    <input type="checkbox" defaultChecked={!!it.is_active} onChange={(e)=>saveInline(it.id, { is_active: e.target.checked })} /> Active
                  </label>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={()=>removeItem(it.id)}><Trash2 className="w-4 h-4"/></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
