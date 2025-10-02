import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { formatDateTime, toDatetimeLocalValue } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Settings, Loader2, ShieldCheck, RefreshCcw, LayoutDashboard, BellRing, Gift, ListChecks, Eye } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';

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
    <div className="space-y-4 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <ShieldCheck className="mr-2" /> Admin: Notifications
          </h2>
          <p className="text-muted-foreground text-sm">Announcements aur quiz notifications yahan se bhejein</p>
        </div>
      </div>

      {/* New section for sending Push Notifications */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg mb-6">
        <h3 className="text-xl font-bold text-foreground mb-4 flex items-center"><BellRing className="w-5 h-5 mr-2"/>Send Push Notification</h3>
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

      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ntitle">Title *</Label>
              <Input id="ntitle" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g., Quiz Starting Soon" required />
            </div>
            <div>
              <Label htmlFor="ntype">Type *</Label>
              <select id="ntype" value={type} onChange={(e)=>setType(e.target.value)} className="w-full border border-border bg-background text-foreground rounded-md px-3 py-2">
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

      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-foreground mb-3 flex items-center"><ListChecks className="w-5 h-5 mr-2"/>Recent</h3>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2"/> Loading...</div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No notifications</div>
        ) : (
          <div className="space-y-2">
            {recent.map((n)=> (
              <div key={n.id} className="p-3 rounded-xl bg-card/80 border border-border flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-foreground">{n.title} <span className="text-xs text-muted-foreground">({n.type})</span></div>
                  <div className="text-foreground/80">{n.message}</div>
                  <div className="text-muted-foreground text-xs">Quiz: {n.quiz_id || '—'} • Scheduled: {n.scheduled_at ? new Date(n.scheduled_at).toLocaleString() : 'now'} • Created: {new Date(n.created_at).toLocaleString()}</div>
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
  // Inline question composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [newQ, setNewQ] = useState({ text: '', options: ['','', '', ''], correctIndex: 0 });
  // Bulk add dialog state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState('append'); // 'append' | 'replace'
  const [bulkWorking, setBulkWorking] = useState(false);
  // Publish panel removed in simplified flow
  const [busyQuizId, setBusyQuizId] = useState(null);
  const categories = ['opinion', 'gk', 'movies', 'sports'];
  // Create flow: entry mode and structured builder state
  const [entryMode, setEntryMode] = useState('form'); // 'form' | 'paste'
  const makeBlankQuestion = () => ({ text: '', options: ['', ''], correctIndex: 0 });
  const [questionsDraft, setQuestionsDraft] = useState([makeBlankQuestion()]);

  // Removed translation trigger and auto-sync; no-op now

  const [quizForm, setQuizForm] = useState({
    title: '', prizes: ['', '', ''], start_time: '', end_time: '', category: '', bulk_text: '', prize_type: 'money'
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

  // Util: parse bulk text into structured questions with strict validation and RAW checkbox support
  const parseBulkQuestions = (text, { strict = false, allowZeroCorrect = false } = {}) => {
    const blocks = String(text || '').trim().split(/\n\s*\n+/); // split by blank lines
    const items = [];
    const errors = [];
    const warnings = [];
    let qCounter = 0;
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map(l => l.trim());
      const nonEmpty = lines.filter(Boolean);
      if (!nonEmpty.length) continue;
      qCounter += 1;
      // First non-empty line is question
      const qline = nonEmpty[0].replace(/^Q\d*\.?\s*/i, '').replace(/^Question\s*[:\-]\s*/i, '');
      const opts = [];
      let answerLine = '';
      let tickedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const ln = lines[i];
        if (!ln) continue;
        if (/^ans(wer)?\s*[:\-]/i.test(ln)) { answerLine = ln; continue; }
        // Support RAW checkbox style: - [x] text or - [ ] text
        const cb = ln.match(/^[-*•]?\s*\[(x|X| )\]\s*(.+)$/);
        if (cb) {
          const isX = /x/i.test(cb[1]);
          if (isX) tickedCount += 1;
          opts.push({ option_text: cb[2].trim(), is_correct: isX });
          continue;
        }
        // Fallback option markers: -, *, A) B) 1) etc
        const m = ln.match(/^(?:[-*•]|[A-Da-d]\)|\d+\)|[A-Da-d][.:])\s*(.+)$/);
        let textOnly = m ? m[1].trim() : ln.replace(/^[*]\s*/, '').trim();
        const isStar = /^\*/.test(ln);
        if (isStar) tickedCount += 1;
        if (textOnly) opts.push({ option_text: textOnly, is_correct: isStar });
      }
      // Determine correct from Answer: X (if provided)
      if (answerLine) {
        const ans = answerLine.split(/[:\-]/).slice(1).join(':').trim();
        const letter = ans.match(/^[A-Da-d]/)?.[0]?.toUpperCase();
        const indexNum = parseInt(ans, 10);
        if (letter) {
          const idx = { A:0, B:1, C:2, D:3 }[letter];
          if (Number.isInteger(idx) && opts[idx]) { opts.forEach((o, i) => o.is_correct = i === idx); tickedCount = 1; }
        } else if (!isNaN(indexNum) && indexNum >= 1 && opts[indexNum-1]) {
          opts.forEach((o, i) => o.is_correct = i === (indexNum-1));
          tickedCount = 1;
        } else {
          // match by text include
          const target = ans.toLowerCase();
          const found = opts.findIndex(o => o.option_text.toLowerCase() === target || o.option_text.toLowerCase().includes(target));
          if (found >= 0) { opts.forEach((o, i) => o.is_correct = i === found); tickedCount = 1; }
        }
      }
      // Clean and enforce max 4 options (preserve correct if possible)
      let cleanOpts = opts.filter(o => o.option_text);
      if (cleanOpts.length > 4) {
        // Keep the first marked-correct if any, plus first 3 others preserving order
        const correctIdx = cleanOpts.findIndex(o => o.is_correct);
        if (correctIdx >= 0) {
          const correct = cleanOpts[correctIdx];
          const others = cleanOpts.filter((_, i) => i !== correctIdx);
          cleanOpts = [correct, ...others.slice(0, 3)];
        } else {
          cleanOpts = cleanOpts.slice(0, 4);
        }
        warnings.push(`Q${qCounter}: More than 4 options found; trimmed to 4 (kept the marked correct).`);
      }
      // Validation: question text
      if (!qline) { errors.push(`Q${qCounter}: Question text missing.`); continue; }
      // Validation: min 2 options
      if (cleanOpts.length < 2) { errors.push(`Q${qCounter}: At least 2 options required.`); continue; }
      // Validation: exactly one correct if strict
      let correctCount = cleanOpts.filter(o => o.is_correct).length;
      if (allowZeroCorrect) {
        // Opinion: ignore any correctness marks; set all to false
        if (correctCount > 0) warnings.push(`Q${qCounter}: Correct marks ignored for opinion category.`);
        cleanOpts = cleanOpts.map(o => ({ ...o, is_correct: false }));
      } else if (strict) {
        if (correctCount === 0) {
          errors.push(`Q${qCounter}: Mark exactly one correct option with [x] or provide an Answer: line.`);
        } else if (correctCount > 1) {
          errors.push(`Q${qCounter}: Multiple correct marks detected; keep only one [x] or use a single Answer: line.`);
        }
      } else {
        // Non-strict: ensure at least one correct by defaulting to first if none
        if (correctCount === 0) cleanOpts[0].is_correct = true;
        else if (correctCount > 1) {
          let seen = false;
          cleanOpts = cleanOpts.map(o => {
            if (o.is_correct && !seen) { seen = true; return o; }
            return { ...o, is_correct: false };
          });
        }
      }
      items.push({ question_text: qline, options: cleanOpts });
    }
    return { items, errors, warnings };
  };

  // Bulk insert using RPC if available; else fallback to client-side
  const bulkInsertQuestions = async (quizId, items, mode = 'append') => {
    // Try RPC first
    try {
      const { error } = await supabase.rpc('admin_bulk_upsert_questions', {
        p_quiz_id: quizId,
        p_payload: items,
        p_mode: mode,
      });
      if (!error) return { ok: true };
    } catch { /* fallback */ }

    // Fallback: client-side inserts
    if (mode === 'replace') {
      await supabase.from('questions').delete().eq('quiz_id', quizId);
    }
    // Insert questions
    for (const it of items) {
      const { data: qrow, error: qerr } = await supabase
        .from('questions')
        .insert({ quiz_id: quizId, question_text: it.question_text })
        .select('id')
        .single();
      if (qerr) return { ok: false, message: qerr.message };
      const qid = qrow.id;
      const optsRows = it.options.map(o => ({ question_id: qid, option_text: o.option_text, is_correct: !!o.is_correct }));
      const { error: oerr } = await supabase.from('options').insert(optsRows);
      if (oerr) return { ok: false, message: oerr.message };
    }
    return { ok: true };
  };

  // Questions & Options CRUD
  const addQuestion = () => {
    // Toggle inline composer instead of prompt
    setComposerOpen(true);
  };

  const saveNewQuestion = async () => {
    if (!selectedQuiz) return;
    const locked = selectedQuiz?.start_time ? (new Date(selectedQuiz.start_time).getTime() <= Date.now()) : false;
    if (locked) { toast({ title:'Locked', description:'Cannot add after quiz start', variant:'destructive' }); return; }
    const text = (newQ.text || '').trim();
  const opts = (newQ.options || []).map(o => (o || '').trim()).filter(Boolean).slice(0, 4);
    if (!text) { toast({ title:'Question required', variant:'destructive' }); return; }
    if (opts.length < 2) { toast({ title:'At least 2 options required', variant:'destructive' }); return; }
  const isOpinionSel = selectedQuiz?.category === 'opinion';
  const cIdx = Math.min(Math.max(newQ.correctIndex || 0, 0), opts.length - 1);
    try {
      const { data: qrow, error: qerr } = await supabase
        .from('questions')
        .insert({ quiz_id: selectedQuiz.id, question_text: text })
        .select('id')
        .single();
      if (qerr) throw qerr;
    const qid = qrow.id;
    const rows = opts.map((opt, i) => ({ question_id: qid, option_text: opt, is_correct: isOpinionSel ? false : i === cIdx }));
      const { error: oerr } = await supabase.from('options').insert(rows);
      if (oerr) throw oerr;
      toast({ title:'Added', description:'Question created' });
      setComposerOpen(false);
      setNewQ({ text:'', options:['','','',''], correctIndex:0 });
      await fetchQuestions(selectedQuiz.id);
    } catch (e) {
      toast({ title:'Add failed', description:e.message, variant:'destructive' });
    }
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
      // Validate required fields
      const errs = [];
      const title = (quizForm.title || '').trim();
      if (!quizForm.category) errs.push('Please choose a category');
      if (!title || title.length < 3) errs.push('Title is too short');
      if (!quizForm.start_time) errs.push('Start time is required');
      if (!quizForm.end_time) errs.push('End time is required');
      // Build from structured form mode always (require review)
      let prepared = { items: [], errors: [], warnings: [] };
      const items = [];
      if (!questionsDraft.length) errs.push('Add at least one question');
      questionsDraft.forEach((q, i) => {
        const qText = (q.text || '').trim();
        const opts = (q.options || []).map(o => (o || '').trim()).filter(Boolean).slice(0,4);
        if (!qText) prepared.errors.push(`Q${i+1}: Question text is required`);
        if (opts.length < 2) prepared.errors.push(`Q${i+1}: At least 2 options required`);
        if (opts.length > 4) prepared.warnings.push(`Q${i+1}: Max 4 options; extra ignored`);
        const cIdx = Math.max(0, Math.min(q.correctIndex ?? 0, opts.length - 1));
        // Ensure exactly one correct
        const builtOpts = opts.map((t, idx) => ({ option_text: t, is_correct: idx === cIdx }));
        if (qText && opts.length >= 2) items.push({ question_text: qText, options: builtOpts });
      });
      prepared.items = items;
      if (prepared.errors.length) errs.push(prepared.errors[0]);
      if (!prepared.items.length) errs.push('No valid questions detected');
      if (entryMode === 'paste') errs.push('Load pasted questions into Form and review before creating');

      const toLocalDate = (val) => { try { const d = new Date(val); return isNaN(d.getTime()) ? null : d; } catch { return null; } };
      const dStart = toLocalDate(quizForm.start_time);
      const dEnd = toLocalDate(quizForm.end_time);
      if (!dStart || !dEnd) errs.push('Invalid start/end time');
      if (dStart && dEnd && dEnd <= dStart) errs.push('End time must be after start time');
      // Optional: enforce future start time
      if (dStart && dStart.getTime() < Date.now() - 60_000) errs.push('Start time must be in the future');

      // Prizes: require 1st prize positive integer; others >= 0 if provided
      const p0 = parseInt(quizForm.prizes[0] || '', 10);
      const p1 = quizForm.prizes[1] ? parseInt(quizForm.prizes[1], 10) : 0;
      const p2 = quizForm.prizes[2] ? parseInt(quizForm.prizes[2], 10) : 0;
      if (isNaN(p0) || p0 <= 0) errs.push('1st prize must be a positive number');
      if (quizForm.prizes[1] && (isNaN(p1) || p1 < 0)) errs.push('2nd prize must be 0 or more');
      if (quizForm.prizes[2] && (isNaN(p2) || p2 < 0)) errs.push('3rd prize must be 0 or more');

      if (errs.length) {
        toast({ title: 'Please fix the form', description: errs[0], variant: 'destructive' });
        return;
      }

      const prizesArray = quizForm.prizes.filter(p => p).map(p => parseInt(p));
      const prizePool = prizesArray.reduce((sum, prize) => sum + prize, 0);

      // Convert local datetime-local strings to UTC ISO
      const toISOorNull = (val) => {
        if (!val) return null;
        // val is like '2025-10-01T21:30'
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };
      const { data: insertData, error } = await supabase
        .from('quizzes')
        .insert([{
          title: quizForm.title,
          prize_pool: prizePool,
          prizes: prizesArray,
          // Single-step creation with schedule
          start_time: toISOorNull(quizForm.start_time),
          end_time: toISOorNull(quizForm.end_time),
          status: 'upcoming',
          category: quizForm.category || null,
          prize_type: quizForm.prize_type || 'money'
        }])
        .select('id, title, category, prizes, prize_pool, start_time, end_time')
        .single();

      if (error) throw error;

  toast({ title: 'Quiz created', description: 'Questions will be saved now.' });
  // Use prepared items BEFORE resetting form state
  const initialItems = prepared.items;

      setShowCreateQuiz(false);
  setQuizForm({ title: '', prizes: ['', '', ''], start_time: '', end_time: '', category: '', bulk_text: '', prize_type: 'money' });
  setEntryMode('form');
  setQuestionsDraft([makeBlankQuestion()]);
      // Open Questions editor directly for the created draft
      setSelectedQuiz(insertData);
      // If bulk text was provided in create form, apply immediately (replace)
      if (initialItems.length > 0) {
        setBulkWorking(true);
        const res = await bulkInsertQuestions(insertData.id, initialItems, 'replace');
        setBulkWorking(false);
        if (!res.ok) {
          toast({ title: 'Bulk add failed', description: res.message || 'Please try again', variant: 'destructive' });
        } else {
          toast({ title: 'Questions added', description: `${initialItems.length} questions created.` });
        }
      }
      await fetchQuestions(insertData.id);
      setShowQuestions(true);
      // Also refresh list in background
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
    <div className="container mx-auto px-4 py-8 max-w-6xl text-foreground">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Quiz Dangal Admin</h1>
  <p className="text-muted-foreground">Admin dashboard</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { key: 'overview', title: 'Overview', icon: <LayoutDashboard className="w-4 h-4"/> },
          { key: 'notifications', title: 'Notifications', icon: <BellRing className="w-4 h-4"/> },
          { key: 'redemptions', title: 'Redemptions', icon: <Gift className="w-4 h-4"/> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors inline-flex items-center gap-2 ${t.key === activeTab
              ? 'bg-primary text-primary-foreground border-transparent shadow'
              : 'bg-muted text-muted-foreground border-border hover:text-foreground'} `}
          >
            {t.icon}
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-foreground mb-1">Create New Quiz</h2>
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
                      className={`px-3 py-1 rounded-full border text-sm capitalize ${quizForm.category === c ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {!quizForm.category && (
                  <p className="text-xs text-destructive mt-1">Please choose a category</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Quiz Title</Label>
                  <Input id="title" value={quizForm.title} onChange={(e) => setQuizForm({...quizForm, title: e.target.value})} placeholder="Daily Opinion Quiz - Evening" required />
                </div>
              </div>

              <div>
                <Label>Prize Distribution</Label>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <div className="flex gap-2">
                    {['money','coins','others'].map(pt => (
                      <button type="button" key={pt} onClick={()=>setQuizForm({...quizForm, prize_type: pt})} className={`px-2 py-1 rounded border text-xs capitalize ${quizForm.prize_type===pt?'bg-primary text-primary-foreground border-transparent':'bg-muted text-muted-foreground border-border'}`}>{pt}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder={quizForm.prize_type==='coins'?"1st Prize (coins)":"1st Prize (amount)"} value={quizForm.prizes[0]} onChange={(e) => { const p=[...quizForm.prizes]; p[0]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                  <Input placeholder={quizForm.prize_type==='coins'?"2nd Prize (coins)":"2nd Prize (amount)"} value={quizForm.prizes[1]} onChange={(e) => { const p=[...quizForm.prizes]; p[1]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                  <Input placeholder={quizForm.prize_type==='coins'?"3rd Prize (coins)":"3rd Prize (amount)"} value={quizForm.prizes[2]} onChange={(e) => { const p=[...quizForm.prizes]; p[2]=e.target.value; setQuizForm({...quizForm, prizes:p}); }} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input type="datetime-local" value={quizForm.start_time} onChange={(e)=>setQuizForm({ ...quizForm, start_time: e.target.value })} required />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="datetime-local" value={quizForm.end_time} onChange={(e)=>setQuizForm({ ...quizForm, end_time: e.target.value })} required />
                </div>
              </div>

              {/* Entry mode toggle */}
              <div className="flex items-center gap-3">
                <Label>Questions entry mode:</Label>
                <div className="flex gap-2">
                  <button type="button" className={`px-3 py-1 rounded-md text-sm border ${entryMode==='form'?'bg-primary text-primary-foreground border-transparent':'bg-muted text-muted-foreground border-border'}`} onClick={()=>setEntryMode('form')}>Form</button>
                  <button type="button" className={`px-3 py-1 rounded-md text-sm border ${entryMode==='paste'?'bg-primary text-primary-foreground border-transparent':'bg-muted text-muted-foreground border-border'}`} onClick={()=>setEntryMode('paste')}>Paste</button>
                </div>
              </div>

              {entryMode === 'form' ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {quizForm.category === 'opinion' ? 'Add questions with 2–4 options. No correct option in Opinion category.' : 'Add questions with 2–4 options. Select exactly one correct.'}
                  </div>
                  {questionsDraft.map((q, qi) => (
                    <div key={qi} className="p-3 rounded-xl border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10">Q{qi+1}.</span>
                        <Input value={q.text} onChange={(e)=>{ const arr=[...questionsDraft]; arr[qi] = { ...arr[qi], text: e.target.value }; setQuestionsDraft(arr); }} placeholder="Question text" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" className="border-red-300 text-red-600" onClick={()=>{ const arr=[...questionsDraft]; arr.splice(qi,1); setQuestionsDraft(arr.length?arr:[makeBlankQuestion()]); }}>Remove</Button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {(q.options||[]).slice(0,4).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            {quizForm.category !== 'opinion' && (
                              <input type="radio" name={`qdraft-${qi}`} checked={(q.correctIndex??0)===oi} onChange={()=>{ const arr=[...questionsDraft]; arr[qi] = { ...arr[qi], correctIndex: oi }; setQuestionsDraft(arr); }} />
                            )}
                            <Input value={opt} onChange={(e)=>{ const arr=[...questionsDraft]; const ops=[...(arr[qi].options||[])]; ops[oi] = e.target.value; arr[qi] = { ...arr[qi], options: ops }; setQuestionsDraft(arr); }} placeholder={`Option ${oi+1}`} className="flex-1" />
                            {(q.options||[]).length>2 && (
                              <Button type="button" variant="outline" size="sm" className="border-red-300 text-red-600" onClick={()=>{ const arr=[...questionsDraft]; const ops=[...(arr[qi].options||[])]; ops.splice(oi,1); const newCorrect=Math.min(arr[qi].correctIndex??0, ops.length-1); arr[qi] = { ...arr[qi], options: ops, correctIndex: newCorrect }; setQuestionsDraft(arr); }}>Delete</Button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 disabled:opacity-60" disabled={(q.options||[]).length>=4} onClick={()=>{ const arr=[...questionsDraft]; const ops=[...(arr[qi].options||[])].slice(0,4).concat(''); arr[qi] = { ...arr[qi], options: ops }; setQuestionsDraft(arr); }}><Plus className="w-4 h-4 mr-1"/>Add Option</Button>
                          <div className="text-xs text-muted-foreground">Max 4 options.</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button type="button" onClick={()=> setQuestionsDraft(prev => [...prev, makeBlankQuestion()])}><Plus className="w-4 h-4 mr-1"/>Add Question</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Paste Questions (RAW format) *</Label>
                  <Textarea
                    placeholder={'Use RAW format with [x]/[ ] tick and max 4 options. Example:\nQ1. Capital of India?\n- [ ] Mumbai\n- [x] Delhi\n- [ ] Kolkata\n- [ ] Jaipur\n\nQ2. Best color?\n- [x] Blue\n- [ ] Red\n- [ ] Green\n(Alternatively, provide Answer: B or Answer: 2 line)'}
                    value={quizForm.bulk_text}
                    onChange={(e)=>setQuizForm({ ...quizForm, bulk_text: e.target.value })}
                    className="mt-1 h-40"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{quizForm.category === 'opinion' ? 'No correct option required for Opinion category.' : 'Mark exactly one correct option per question with [x] or Answer: A/B/1.'} Max 4 options per question.</p>
                  {(() => { const { items, errors, warnings } = parseBulkQuestions(quizForm.bulk_text, { strict: true, allowZeroCorrect: quizForm.category === 'opinion' }); return (
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="text-foreground/80">Preview: {items.length} questions</div>
                      {warnings.length > 0 && (
                        <div className="text-xs text-amber-600">{warnings[0]}{warnings.length>1?` (+${warnings.length-1} more)`:''}</div>
                      )}
                      {errors.length > 0 && (
                        <div className="text-xs text-destructive">{errors[0]}{errors.length>1?` (+${errors.length-1} more)`:''}</div>
                      )}
                      <div className="pt-2">
                        <Button type="button" onClick={() => {
                          const parsed = parseBulkQuestions(quizForm.bulk_text, { strict: true, allowZeroCorrect: quizForm.category === 'opinion' });
                          if (parsed.errors.length) { toast({ title:'Fix pasted input', description: parsed.errors[0], variant:'destructive' }); return; }
                          if (!parsed.items.length) { toast({ title:'No valid questions', variant:'destructive' }); return; }
                          const draft = parsed.items.map((it) => {
                            const opts = (it.options || []).slice(0,4);
                            const correctIdx = quizForm.category === 'opinion' ? 0 : Math.max(0, opts.findIndex(o => o.is_correct));
                            return { text: it.question_text, options: opts.map(o => o.option_text), correctIndex: correctIdx < 0 ? 0 : correctIdx };
                          });
                          setQuestionsDraft(draft.length ? draft : [makeBlankQuestion()]);
                          setEntryMode('form');
                          toast({ title:'Loaded into form', description:`${draft.length} questions ready to review & edit.` });
                        }} className="bg-indigo-600 hover:bg-indigo-700">Load into Form (Preview & Edit)</Button>
                      </div>
                    </div>
                  ); })()}
                </div>
              )}
              {/* Times will be set on Publish */}

              <div className="flex space-x-4">
                {(() => {
                  let disableCreate = false;
                  if (entryMode === 'paste') {
                    disableCreate = true;
                  } else {
                    // Form mode: ensure at least one valid question
                    const valid = questionsDraft.some(q => (q.text||'').trim() && (q.options||[]).filter(o => (o||'').trim()).length >= 2);
                    disableCreate = !valid;
                  }
                  return (
                    <Button type="submit" disabled={disableCreate} className="bg-green-600 hover:bg-green-700 disabled:opacity-60">Create Quiz</Button>
                  );
                })()}
                <Button type="button" variant="outline" onClick={() => setShowCreateQuiz(false)}>Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Quizzes List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center"><ListChecks className="w-5 h-5 mr-2"/>All Quizzes</h2>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2" /> Loading quizzes...
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Active / Upcoming</h3>
                <div className="space-y-4 mt-2">
                  {quizzes.filter(q => { const now=Date.now(); const st=q.start_time?new Date(q.start_time).getTime():null; const en=q.end_time?new Date(q.end_time).getTime():null; return en===null || now<=en; }).map((quiz, index) => (
                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground">{quiz.title}</h3>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Category: {quiz.category || '—'}</span>
                            <span>Prize Type: {quiz.prize_type || 'money'}</span>
                            <span>Prize Pool: {quiz.prize_type==='coins'?'🪙':''}₹{quiz.prize_pool}</span>
                            <span>Prizes: {quiz.prize_type==='coins'?'🪙 ':''}{Array.isArray(quiz.prizes)?quiz.prizes.join(', '):''}</span>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            <span>Start: {quiz.start_time ? formatDateTime(quiz.start_time) : '—'}</span>
                            <span className="ml-4">End: {quiz.end_time ? formatDateTime(quiz.end_time) : '—'}</span>
                          </div>
                          {(() => { const locked = quiz.start_time ? (new Date(quiz.start_time).getTime() <= Date.now()) : false; return (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select disabled={locked} title={locked ? 'Locked after start time' : undefined} className={`border border-border bg-background text-foreground rounded-md px-2 py-2 capitalize ${locked ? 'opacity-60 cursor-not-allowed' : ''}`} value={quiz.category || ''} onChange={async (e)=>{ if (locked) { toast({ title:'Locked', description:'Cannot change after start', variant:'destructive' }); return; } const { error } = await supabase.from('quizzes').update({ category: e.target.value }).eq('id', quiz.id); if (error) toast({ title:'Update failed', description:error.message, variant:'destructive' }); else fetchQuizzes(); }}>
                              <option value="">Select category</option>
                              {categories.map(c => (<option value={c} key={c}>{c}</option>))}
                            </select>
                            <Input type="datetime-local" disabled={locked} title={locked ? 'Locked after start time' : undefined} value={toDatetimeLocalValue(quiz.start_time)} onChange={async (e)=>{
                              if (locked) { toast({ title:'Locked', description:'Cannot change after start', variant:'destructive' }); return; }
                              const val = e.target.value;
                              const iso = val ? new Date(val).toISOString() : null;
                              quizzes[index].start_time = iso;
                              setQuizzes([...quizzes]);
                              const { error } = await supabase.from('quizzes').update({ start_time: iso }).eq('id', quiz.id);
                              if (error) { toast({ title:'Update failed', description:error.message, variant:'destructive' }); fetchQuizzes(); }
                            }} />
                            <Input type="datetime-local" disabled={locked} title={locked ? 'Locked after start time' : undefined} value={toDatetimeLocalValue(quiz.end_time)} onChange={async (e)=>{
                              if (locked) { toast({ title:'Locked', description:'Cannot change after start', variant:'destructive' }); return; }
                              const val = e.target.value;
                              const iso = val ? new Date(val).toISOString() : null;
                              quizzes[index].end_time = iso;
                              setQuizzes([...quizzes]);
                              const { error } = await supabase.from('quizzes').update({ end_time: iso }).eq('id', quiz.id);
                              if (error) { toast({ title:'Update failed', description:error.message, variant:'destructive' }); fetchQuizzes(); }
                            }} />
                          </div>
                          ); })()}
                        </div>
                        {(() => { const now = Date.now(); const st = quiz.start_time ? new Date(quiz.start_time).getTime() : null; const canDelete = !st || now < st; return (
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => recomputeResults(quiz.id)} disabled={busyQuizId === quiz.id} className="text-indigo-600 hover:text-indigo-700">{busyQuizId === quiz.id ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin"/>Recomputing</>) : (<><RefreshCcw className="h-4 w-4 mr-1"/>Recompute</>)}</Button>
                          <Link to={`/results/${quiz.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted text-blue-600"><Eye className="h-4 w-4"/> Results</Link>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedQuiz(quiz); fetchQuestions(quiz.id); setShowQuestions(true); }} className="text-blue-600 hover:text-blue-700"><Settings className="h-4 w-4" />Questions</Button>
                          <div className="relative group">
                            <Button size="sm" variant="outline" onClick={() => deleteQuiz(quiz.id)} disabled={!canDelete} className={`${canDelete ? 'text-red-600 hover:text-red-700' : 'text-muted-foreground opacity-60 cursor-not-allowed'}`}><Trash2 className="h-4 w-4" /></Button>
                            {!canDelete && (<div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-popover text-popover-foreground border border-border px-2 py-1 rounded shadow hidden group-hover:block">Cannot delete after start time</div>)}
                          </div>
                        </div>
                        ); })()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground">Finished</h3>
                <div className="space-y-4 mt-2">
                  {quizzes.filter(q => { const now=Date.now(); const en=q.end_time?new Date(q.end_time).getTime():null; return en!==null && now>en; }).map((quiz, index) => (
                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground">{quiz.title}</h3>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Category: {quiz.category || '—'}</span>
                            <span>Prize Type: {quiz.prize_type || 'money'}</span>
                            <span>Prize Pool: {quiz.prize_type==='coins'?'🪙':''}₹{quiz.prize_pool}</span>
                            <span>Prizes: {quiz.prize_type==='coins'?'🪙 ':''}{Array.isArray(quiz.prizes)?quiz.prizes.join(', '):''}</span>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            <span>Start: {quiz.start_time ? formatDateTime(quiz.start_time) : '—'}</span>
                            <span className="ml-4">End: {quiz.end_time ? formatDateTime(quiz.end_time) : '—'}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Link to={`/results/${quiz.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted text-blue-600"><Eye className="h-4 w-4"/> Results</Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Questions Editor Panel */}
        {showQuestions && selectedQuiz && (
          <div className="mt-6 bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">Questions for: {selectedQuiz.title}</h3>
              <div className="flex gap-2">
                {(() => { const locked = selectedQuiz?.start_time ? (new Date(selectedQuiz.start_time).getTime() <= Date.now()) : false; return (
                <>
                <Button onClick={() => { if (locked) { toast({ title:'Locked', description:'Cannot add after quiz start', variant:'destructive' }); return; } setComposerOpen(true); }} disabled={locked} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60" size="sm"><Plus className="w-4 h-4 mr-1"/>{composerOpen ? 'Composer Open' : 'Add Question'}</Button>
                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={locked}>Bulk Add/Replace</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Bulk add questions</DialogTitle>
                      <DialogDescription>Paste multiple questions with options. Supported formats shown below.</DialogDescription>
                    </DialogHeader>
                    <div>
                      <Textarea value={bulkText} onChange={(e)=>setBulkText(e.target.value)} className="h-56" disabled={locked} placeholder={
                        'RAW format with [x]/[ ] and max 4 options. Example:\nQ. Sample?\n- [x] Option 1\n- [ ] Option 2\n- [ ] Option 3\n- [ ] Option 4\n\nAlternatively: use Answer: B or Answer: 2'
                      } />
                      {(() => { const { items, errors, warnings } = parseBulkQuestions(bulkText, { strict: true, allowZeroCorrect: selectedQuiz?.category === 'opinion' }); return (
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="text-foreground/80">Preview: {items.length} questions</div>
                            <label className="text-sm text-foreground/80 flex items-center gap-2">
                              <span>Mode:</span>
                              <select value={bulkMode} onChange={(e)=>setBulkMode(e.target.value)} className="border border-border bg-background text-foreground rounded-md px-2 py-1 text-sm" disabled={locked}>
                                <option value="append">Append</option>
                                <option value="replace">Replace existing</option>
                              </select>
                            </label>
                          </div>
                          {warnings.length > 0 && (
                            <div className="text-xs text-amber-600">{warnings[0]}{warnings.length>1?` (+${warnings.length-1} more)`:''}</div>
                          )}
                          {errors.length > 0 && (
                            <div className="text-xs text-destructive">{errors[0]}{errors.length>1?` (+${errors.length-1} more)`:''}</div>
                          )}
                        </div>
                      ); })()}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button disabled={bulkWorking || locked || parseBulkQuestions(bulkText, { strict: true, allowZeroCorrect: selectedQuiz?.category === 'opinion' }).errors.length > 0} onClick={async ()=>{
                        const parsed = parseBulkQuestions(bulkText, { strict: true, allowZeroCorrect: selectedQuiz?.category === 'opinion' });
                        const items = parsed.items;
                        if (!items.length) { toast({ title: 'No valid questions detected', variant: 'destructive' }); return; }
                        setBulkWorking(true);
                        const res = await bulkInsertQuestions(selectedQuiz.id, items, bulkMode);
                        setBulkWorking(false);
                        if (!res.ok) { toast({ title: 'Bulk add failed', description: res.message || 'Try again', variant: 'destructive' }); return; }
                        toast({ title: 'Questions added', description: `${items.length} questions processed.` });
                        setBulkOpen(false); setBulkText('');
                        await fetchQuestions(selectedQuiz.id);
                      }}>{bulkWorking ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin"/>Working…</>) : 'Apply'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {/* Publish panel removed */}
                <Button variant="outline" size="sm" onClick={()=>setShowQuestions(false)}>Close</Button>
                </>
                ); })()}
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">No questions yet</div>
            ) : (
              <div className="space-y-4">
                {/* Inline Composer */}
                {(() => { const locked = selectedQuiz?.start_time ? (new Date(selectedQuiz.start_time).getTime() <= Date.now()) : false; if (!composerOpen) return null; const isOpinionSel = selectedQuiz?.category === 'opinion'; return (
                  <div className="p-3 rounded-xl bg-card/80 border border-border">
                    <div className="mb-2 text-sm font-semibold text-foreground">New Question</div>
                    <Input
                      placeholder="Type your question"
                      value={newQ.text}
                      disabled={locked}
                      onChange={(e)=>setNewQ(prev => ({...prev, text: e.target.value }))}
                      className="mb-3"
                    />
                    <div className="space-y-2">
                      {(newQ.options || []).slice(0,4).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {!isOpinionSel && (
                            <input
                              type="radio"
                              name="newq-correct"
                              checked={newQ.correctIndex === idx}
                              disabled={locked}
                              onChange={()=>setNewQ(prev => ({...prev, correctIndex: idx }))}
                            />
                          )}
                          <Input
                            placeholder={`Option ${idx+1}`}
                            value={opt}
                            disabled={locked}
                            onChange={(e)=>{
                              const arr = [...newQ.options]; arr[idx] = e.target.value; setNewQ(prev => ({...prev, options: arr }));
                            }}
                            className="flex-1"
                          />
                          {newQ.options.length > 2 && (
                            <Button type="button" variant="outline" size="sm" className={`border-red-300 ${locked ? 'text-muted-foreground opacity-60 cursor-not-allowed' : 'text-red-600'}`} disabled={locked}
                              onClick={()=>{ const arr=[...newQ.options]; arr.splice(idx,1); setNewQ(prev => ({...prev, options: arr, correctIndex: Math.min(prev.correctIndex, arr.length-1) })); }}>
                              <Trash2 className="w-4 h-4"/>
                            </Button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 disabled:opacity-60" disabled={locked || (newQ.options || []).length >= 4}
                          onClick={()=> setNewQ(prev => ({...prev, options: [...prev.options].slice(0,4).concat('') }))}>
                          <Plus className="w-4 h-4 mr-1"/> Add Option
                        </Button>
                        <div className="text-xs text-muted-foreground">{isOpinionSel ? 'Opinion: no correct option needed.' : 'Select the correct option. Max 4 options.'}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" onClick={saveNewQuestion} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60" disabled={locked}>Save Question</Button>
                      <Button type="button" variant="outline" onClick={()=>{ setComposerOpen(false); setNewQ({ text:'', options:['','','',''], correctIndex:0 }); }}>Cancel</Button>
                    </div>
                  </div>
                ); })()}

                {questions.map((q) => { const locked = selectedQuiz?.start_time ? (new Date(selectedQuiz.start_time).getTime() <= Date.now()) : false; const isOpinionSel = selectedQuiz?.category === 'opinion'; return (
                  <div key={q.id} className="p-3 rounded-xl bg-card/80 border border-border">
                    <div className="flex items-center gap-2">
                      <Input defaultValue={q.question_text} onBlur={(e)=>{ if (locked) { toast({ title:'Locked', description:'Cannot edit after quiz start', variant:'destructive' }); return; } saveQuestion(q.id, e.target.value); }} className="flex-1" disabled={locked} />
                      <Button variant="outline" size="sm" className={`border-red-300 ${locked ? 'text-muted-foreground opacity-60 cursor-not-allowed' : 'text-red-600'}`} onClick={()=>{ if (locked) { toast({ title:'Locked', description:'Cannot delete after quiz start', variant:'destructive' }); return; } deleteQuestion(q.id); }} disabled={locked}><Trash2 className="w-4 h-4"/></Button>
                    </div>
                    <div className="mt-2 pl-1">
                      <div className="text-xs text-muted-foreground mb-1">Options</div>
                      <div className="space-y-2">
                        {(q.options || []).map((o)=> (
                          <div key={o.id} className="flex items-center gap-2">
                            <Input defaultValue={o.option_text} onBlur={(e)=>{ if (locked) { toast({ title:'Locked', description:'Cannot edit after quiz start', variant:'destructive' }); return; } saveOption(o.id, e.target.value); }} className="flex-1" disabled={locked} />
                            {!isOpinionSel && (
                              <label className="flex items-center gap-1 text-xs text-foreground/80">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  defaultChecked={!!o.is_correct}
                                  disabled={locked}
                                  onChange={async (e)=>{
                                    if (locked) { e.preventDefault(); return; }
                                    if (!e.target.checked) return;
                                    // Set this option correct and others false
                                    const { error: e1 } = await supabase.from('options').update({ is_correct: false }).eq('question_id', q.id);
                                    if (e1) { toast({ title:'Update failed', description:e1.message, variant:'destructive' }); return; }
                                    const { error: e2 } = await supabase.from('options').update({ is_correct: true }).eq('id', o.id);
                                    if (e2) toast({ title:'Update failed', description:e2.message, variant:'destructive' });
                                    await fetchQuestions(selectedQuiz.id);
                                  }}
                                />
                                Correct
                              </label>
                            )}
                            <Button variant="outline" size="sm" className={`border-red-300 ${locked ? 'text-muted-foreground opacity-60 cursor-not-allowed' : 'text-red-600'}`} onClick={()=>{ if (locked) { toast({ title:'Locked', description:'Cannot delete after quiz start', variant:'destructive' }); return; } deleteOption(o.id); }} disabled={locked}><Trash2 className="w-4 h-4"/></Button>
                          </div>
                        ))}
                        <Button onClick={()=>{ if (locked) { toast({ title:'Locked', description:'Cannot add after quiz start', variant:'destructive' }); return; } if ((q.options||[]).length >= 4) { toast({ title:'Limit reached', description:'Max 4 options per question', variant:'destructive' }); return; } addOption(q.id); }} size="sm" className="bg-green-600 hover:bg-green-700 disabled:opacity-60" disabled={locked}><Plus className="w-4 h-4 mr-1"/>Add Option</Button>
                      </div>
                    </div>
                  </div>
                ); })}
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
      .order('coins_required', { ascending: false });
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
        <p className="text-muted-foreground text-sm">Items jinko users coins se redeem kar sakte hain</p>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 shadow-lg">
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

      <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-foreground mb-3">Catalog Items</h3>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline-block h-6 w-6 animate-spin text-indigo-500 mr-2"/> Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No items</div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="p-3 rounded-xl bg-card/80 border border-border flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input defaultValue={it.title} onBlur={(e)=>{ const v=e.target.value.trim(); if (v && v !== it.title) saveInline(it.id, { title: v }); }} className="flex-1" />
                    <Input type="number" min="0" defaultValue={it.coins_required} onBlur={(e)=>{ const n=parseInt(e.target.value,10); if (!isNaN(n) && n !== it.coins_required) saveInline(it.id, { coins_required: n }); }} className="w-32" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{it.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-foreground/80 flex items-center gap-1">
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
