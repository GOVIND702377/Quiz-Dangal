// Unified Admin panel (merged from former AdminClean). Single source of truth.
// Keep this file focused and under control; add new panels as separate components if it grows.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { m, AnimatePresence } from '@/lib/motion-lite';
import { Plus, Trash2, RefreshCcw, ListChecks, Loader2, Eye, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatDateTime } from '@/lib/utils';

// ---------------- Constants & Helpers ----------------
const categoryOptions = [
	{ value: 'opinion', label: 'Opinion' },
	{ value: 'gk', label: 'General Knowledge' },
	{ value: 'sports', label: 'Sports' },
	{ value: 'movies', label: 'Movies' },
];
const getCategoryLabel = (value) => categoryOptions.find(option => option.value === value)?.label || value;
const blankQuestion = () => ({ text: '', options: ['', '', ''], correctIndex: 0 });

function formatPrizeDisplay(type, amount, { fallback = 0 } = {}) {
	if (amount == null) amount = fallback;
	if (type === 'coins') return `${amount} coins`;
	if (type === 'others') return `${amount}`;
	return `₹${amount}`;
}

function parseBulk(text, { allowZeroCorrect = false } = {}) {
	const blocks = String(text || '').trim().split(/\n\s*\n+/);
	const items = []; const errors = []; const warnings = [];
	let qn = 0;
	for (const block of blocks) {
		const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
		if (!lines.length) continue; qn += 1;
		const qline = lines[0].replace(/^Q\d*\.?\s*/i, '').replace(/^Question\s*[:-]\s*/i, '');
		const opts = []; let answerLine = '';
		for (let i=1;i<lines.length;i++) {
			const ln = lines[i];
			if (/^ans(wer)?\s*[:-]/i.test(ln)) { answerLine = ln; continue; }
			const cb = ln.match(/^[-*•]?\s*\[(x|X| )\]\s*(.+)$/); if (cb) { opts.push({ option_text: cb[2].trim(), is_correct: /x/i.test(cb[1]) }); continue; }
			const bullet = ln.match(/^(?:[-*•]|[A-Da-d]\)|\d+\)|[A-Da-d][.:])\s*(.+)$/);
			const textOnly = bullet ? bullet[1].trim() : ln.replace(/^[*]\s*/, '').trim();
			if (textOnly) opts.push({ option_text: textOnly, is_correct: /^\*/.test(ln) });
		}
		if (answerLine) {
			const ans = answerLine.split(/[:-]/).slice(1).join(':').trim();
			const letter = ans.match(/^[A-D]/i)?.[0]?.toUpperCase();
			const idx = letter ? {A:0,B:1,C:2,D:3}[letter] : NaN;
			const num = parseInt(ans,10);
			if (!Number.isNaN(idx) && opts[idx]) opts.forEach((o,i)=>o.is_correct=i===idx);
			else if (!Number.isNaN(num) && opts[num-1]) opts.forEach((o,i)=>o.is_correct=i===num-1);
			else {
				const target = ans.toLowerCase();
				const fi = opts.findIndex(o=>o.option_text.toLowerCase()===target || o.option_text.toLowerCase().includes(target));
				if (fi>=0) opts.forEach((o,i)=>o.is_correct=i===fi);
			}
		}
		let clean = opts.filter(o=>o.option_text);
		if (clean.length>4) { const ci=clean.findIndex(o=>o.is_correct); if (ci>=0) { const c=clean[ci]; const rest=clean.filter((_,i)=>i!==ci); clean=[c,...rest.slice(0,3)]; } else clean=clean.slice(0,4); warnings.push(`Q${qn}: Trimmed to 4 options.`); }
		if (!qline) { errors.push(`Q${qn}: Missing question text.`); continue; }
		if (clean.length<2) { errors.push(`Q${qn}: Need at least 2 options.`); continue; }
		if (allowZeroCorrect) clean = clean.map(o=>({...o,is_correct:false})); else {
			const cc = clean.filter(o=>o.is_correct).length;
			if (cc===0) clean[0].is_correct=true; else if (cc>1) { let seen=false; clean=clean.map(o=> o.is_correct && !seen ? (seen=true, o) : {...o,is_correct:false}); }
		}
		items.push({ question_text: qline, options: clean });
	}
	return { items, errors, warnings };
}

// ---------------- Component ----------------
export default function Admin() {
	const { toast } = useToast();
	const { userProfile, loading: authLoading, user } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const tab = searchParams.get('tab') || 'overview';
	const setTab = t => { searchParams.set('tab', t); setSearchParams(searchParams, { replace:true }); };

	const [quizzes, setQuizzes] = useState([]);
	const [loading, setLoading] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	// Default prize_type to 'coins' so winners get auto-credited by backend award logic
	const [form, setForm] = useState({ title: '', category: '', start_time:'', end_time:'', prizes:['','',''], prize_type:'coins', bulk:'' });
	const [entryMode, setEntryMode] = useState('form');
	const [drafts, setDrafts] = useState([blankQuestion()]);
	const [selectedQuiz, setSelectedQuiz] = useState(null);
	const [questions, setQuestions] = useState([]);
	const [busyQuizId, setBusyQuizId] = useState(null);
	const [showQuestions, setShowQuestions] = useState(false);
	const opinion = form.category === 'opinion';
	const adminEmails = useMemo(() => {
		try {
			const raw = String(import.meta.env.VITE_ADMIN_EMAILS || '').trim();
			if (!raw) return new Set();
			return new Set(
				raw
					.split(/[\s,]+/)
					.map((entry) => entry.trim().toLowerCase())
					.filter(Boolean),
			);
		} catch {
			return new Set();
		}
	}, []);
	const role = String(userProfile?.role || '').trim().toLowerCase();
	const email = String(user?.email || '').trim().toLowerCase();
	const metadataRole = String(user?.app_metadata?.role || '').trim().toLowerCase();
	const isAdmin = role === 'admin' || metadataRole === 'admin' || (email && adminEmails.has(email));

	const fetchQuizzes = useCallback(async ()=>{
		if (!isAdmin) {
			setLoading(false);
			setQuizzes([]);
			return;
		}
		setLoading(true);
		if (!supabase) {
			setQuizzes([]);
			setLoading(false);
			return;
		}
		const { data, error } = await supabase.from('quizzes').select('id,title,category,prizes,prize_pool,prize_type,start_time,end_time').order('start_time', { ascending:false });
		if (error) toast({ title:'Fetch failed', description:error.message, variant:'destructive' });
		else setQuizzes(data||[]);
		setLoading(false);
	},[toast, isAdmin]);

	const fetchQuestions = useCallback(async (quizId)=>{
		if (!isAdmin) {
			setQuestions([]);
			return;
		}
		if (!supabase) { setQuestions([]); return; }
		const { data, error } = await supabase.from('questions').select('id,question_text,options(id,option_text,is_correct)').eq('quiz_id', quizId);
		if (error) toast({ title:'Questions failed', description:error.message, variant:'destructive' }); else setQuestions(data||[]);
	},[toast, isAdmin]);

	useEffect(()=>{ if (authLoading) return; fetchQuizzes(); },[fetchQuizzes, authLoading]);

	const handleCreate = async e => {
		e.preventDefault();
		try {
			if (!isAdmin) {
				toast({ title:'Access denied', description:'Only admins can create quizzes.', variant:'destructive' });
				return;
			}
			const errs = [];
			if (!form.category) errs.push('Select category');
			if (!form.title.trim()) errs.push('Title required');
			if (!form.start_time || !form.end_time) errs.push('Start & End time required');
			const st = new Date(form.start_time); const en = new Date(form.end_time);
			if (en<=st) errs.push('End after start');
			const p0 = parseInt(form.prizes[0]||'',10); if (Number.isNaN(p0)||p0<=0) errs.push('1st prize invalid');
			if (errs.length) { toast({ title:'Fix form', description:errs[0], variant:'destructive'}); return; }

			const items = drafts.map(d=>{ const ops=(d.options||[]).map(o=>o.trim()).filter(Boolean).slice(0,4); if (!d.text.trim()||ops.length<2) return null; const c=Math.min(Math.max(d.correctIndex||0,0), ops.length-1); return { question_text:d.text.trim(), options: ops.map((t,i)=>({ option_text:t, is_correct: opinion ? false : i===c })) }; }).filter(Boolean);
			if (!items.length) { toast({ title:'Add questions', variant:'destructive'}); return; }

			const prizesArr = form.prizes.filter(p=>p).map(p=>parseInt(p,10));
			const prizePool = prizesArr.reduce((s,v)=>s+v,0);
			// Normalize prize_type: if numeric prizes are provided, prefer 'coins' to enable auto-award
			const normalizedPrizeType = (form.prize_type === 'money' && prizePool > 0) ? 'coins' : form.prize_type;
			const payload = { title:form.title.trim(), category:form.category, start_time: new Date(form.start_time).toISOString(), end_time:new Date(form.end_time).toISOString(), prizes:prizesArr, prize_pool:prizePool, prize_type: normalizedPrizeType };
			if (!supabase) throw new Error('Supabase config missing');
			const { data:quiz, error } = await supabase.from('quizzes').insert([payload]).select().single();
			if (error) throw error;
			toast({ title:'Quiz created', description: quiz.title });

			const res = await bulkInsert(quiz.id, items, 'replace');
			if (!res.ok) toast({ title:'Question insert fallback', description:res.message||'Failed', variant:'destructive'}); else toast({ title:'Questions added', description:`${items.length} questions` });
			setShowCreate(false); setForm({ title:'', category:'', start_time:'', end_time:'', prizes:['','',''], prize_type:'coins', bulk:'' }); setDrafts([blankQuestion()]);
			fetchQuizzes();
		} catch (err) {
			toast({ title:'Create failed', description: err.message, variant:'destructive'});
		}
	};

	const bulkInsert = async (quizId, items, mode='append') => {
		if (!isAdmin) return { ok:false, message:'Admin access required' };
		if (!supabase) return { ok:false, message:'No Supabase client' };

		// Prefer edge function that runs with service role to avoid RLS blocks
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData?.session?.access_token;
			const res = await fetch('/functions/v1/admin-upsert-questions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ quizId, items, mode }),
			});
			if (res.ok) {
				return { ok: true };
			}
			// If the function is not deployed fall back; otherwise bubble specific error
			if (res.status !== 404) {
				const info = await res.json().catch(() => ({}));
				throw new Error(info?.error || `HTTP ${res.status}`);
			}
		} catch (fnErr) {
			console.warn('Edge bulk insert failed, falling back to direct RPC path', fnErr);
		}

		// Attempt direct RPC (older deployments)
		try {
			const { error } = await supabase.rpc('admin_bulk_upsert_questions', { p_quiz_id: quizId, p_payload: items, p_mode: mode });
			if (!error) return { ok: true };
			console.warn('admin_bulk_upsert_questions RPC returned error, using manual inserts', error?.message);
		} catch (rpcErr) {
			console.warn('admin_bulk_upsert_questions RPC threw, using manual inserts', rpcErr);
		}

		// Manual fallback (anon key must have insert rights via RLS)
		if (mode==='replace') await supabase.from('questions').delete().eq('quiz_id', quizId);
		for (const it of items) {
			const { data:qrow, error:qerr } = await supabase.from('questions').insert({ quiz_id: quizId, question_text: it.question_text }).select('id').single();
			if (qerr) return { ok:false, message:qerr.message };
			const rows = it.options.map(o=>({ question_id:qrow.id, option_text:o.option_text, is_correct: !!o.is_correct }));
			const { error:oerr } = await supabase.from('options').insert(rows); if (oerr) return { ok:false, message:oerr.message };
		}
		return { ok:true };
	};

	const deleteQuiz = async id => {
		if (!window.confirm('Delete this quiz?')) return;
		if (!isAdmin) { toast({ title:'Access denied', description:'Only admins can delete quizzes.', variant:'destructive' }); return; }
		if(!supabase) return;
		const { error } = await supabase.from('quizzes').delete().eq('id', id);
		if (error) toast({ title:'Delete failed', description:error.message, variant:'destructive'});
		else { toast({ title:'Deleted' }); fetchQuizzes(); }
	};
	const recompute = async id => {
		if (!isAdmin) { toast({ title:'Access denied', description:'Only admins can recompute results.', variant:'destructive' }); return; }
		if(!supabase) return;
		try {
			setBusyQuizId(id);
			const { error } = await supabase.rpc('admin_recompute_quiz_results', { p_quiz_id:id });
			if (error) throw error;
			// Also ensure award pipeline runs (coins only, safe idempotent)
			try {
				await supabase.rpc('compute_results_if_due', { p_quiz_id:id });
			} catch (computeErr) {
				// Swallow non-critical errors; idempotent award path may already have run
				try { if (import.meta.env?.DEV) console.debug('compute_results_if_due failed; continuing', computeErr); } catch { void 0; }
			}
			toast({ title:'Recomputed' });
		} catch(e){
			toast({ title:'Recompute failed', description:e.message, variant:'destructive'});
		} finally { setBusyQuizId(null);} 
	};

	const quizBlocks = useMemo(()=>{
		const now = Date.now();
		const active = []; const finished = [];
		for (const q of quizzes) {
			const end = q.end_time ? new Date(q.end_time).getTime() : null;
			if (end !== null && now > end) finished.push(q); else active.push(q);
		}
		return { active, finished };
	},[quizzes]);

	// Pending redemptions state
	const [pendingRedemptions, setPendingRedemptions] = useState([]);
	const [loadingRedemptions, setLoadingRedemptions] = useState(false);

	const fetchPendingRedemptions = useCallback(async () => {
		if (!isAdmin) { setPendingRedemptions([]); return; }
		if (!supabase) { setPendingRedemptions([]); return; }
		setLoadingRedemptions(true);
		try {
			// Fetch username from profiles via LEFT join (not inner) to include rows even if username is NULL
			const { data, error } = await supabase
				.from('redemptions')
				.select('id,user_id,reward_value,reward_type,coins_required,payout_identifier,payout_channel,requested_at, profiles(username,full_name)')
				.eq('status','pending')
				.order('requested_at',{ ascending:false });
			if (error) throw error;
			setPendingRedemptions(data||[]);
		} catch(e) {
			setPendingRedemptions([]);
			if (import.meta.env.DEV) console.debug('Fetch pending redemptions failed', e);
		} finally {
			setLoadingRedemptions(false);
		}
	}, [isAdmin]);

	const approveRedemption = useCallback(async (id) => {
		if (!isAdmin) return;
		if (!supabase) return;
		// Optimistic UI: remove row immediately
		setPendingRedemptions(prev => prev.filter(r => r.id !== id));
		try {
			const { error } = await supabase.rpc('admin_approve_redemption', { p_redemption_id: id });
			if (error) throw error;
			toast({ title: 'Approved', description: 'Redemption approved.' });
		} catch(e) {
			toast({ title: 'Approve failed', description: e.message, variant: 'destructive' });
			// Re-fetch to restore list if failed
			fetchPendingRedemptions();
		}
	}, [isAdmin, fetchPendingRedemptions, toast]);

	useEffect(() => { fetchPendingRedemptions(); const i = setInterval(fetchPendingRedemptions, 30000); return () => clearInterval(i); }, [fetchPendingRedemptions]);

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
			</div>
		);
	}

	if (!isAdmin) {
		return (
			<>
				<Helmet>
					<meta name="robots" content="noindex, nofollow" />
					<link rel="canonical" href="https://quizdangal.com/admin" />
				</Helmet>
				<div className="min-h-screen flex items-center justify-center px-4">
				<div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full text-center shadow-sm">
					<h2 className="text-xl font-semibold text-red-500 mb-2">Admin access required</h2>
					<p className="text-sm text-gray-600">
						<span>Supabase </span>
						<code>profiles</code>
						<span> table mein aapke record ka </span>
						<strong>role</strong>
						<span> field admin hona chahiye.</span>
					</p>
					<ul className="text-left text-sm text-gray-600 mt-4 space-y-2 list-disc list-inside">
						<li>
							<span>Supabase dashboard</span>
							<span aria-hidden="true" role="presentation" className="mx-1">&rarr;</span>
							<span>Table editor</span>
							<span aria-hidden="true" role="presentation" className="mx-1">&rarr;</span>
							<code>profiles</code>
							<span>&nbsp;me role update karein.</span>
						</li>
						<li>Update ke baad login session refresh karein.</li>
						<li>Dev bypass (<code>VITE_BYPASS_AUTH=1</code>) mein mock admin auto-enable hota hai.</li>
					</ul>
				</div>
				</div>
			</>
		);
	}

	// Tabs defined inline in render; removed unused adminTabs array.

	return (
		<div className="container mx-auto p-6 max-w-5xl bg-white text-gray-900 rounded-2xl shadow-sm">
			<Helmet>
				<meta name="robots" content="noindex, nofollow" />
				<link rel="canonical" href="https://quizdangal.com/admin" />
			</Helmet>
			<h1 className="text-2xl font-bold mb-6 text-gray-900">Admin Dashboard</h1>
			{!hasSupabaseConfig && (
				<div className="mb-6 text-sm text-amber-600">Supabase env keys missing. Read-only UI only.</div>
			)}
			<div className="flex gap-2 mb-6 flex-wrap">
				{['overview','automation','rewards','approvals','notifications'].map(t=> (
					<button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded border text-sm transition-colors ${t===tab? 'bg-indigo-600 text-white border-indigo-600':'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}>{t}</button>
				))}
			</div>
			{tab==='overview' && (
				<div className="space-y-8">
					<div>
						<Button onClick={()=>setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="w-4 h-4 mr-1"/>New Quiz</Button>
					</div>
					<AnimatePresence>
						{showCreate && (
							<m.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
								<h2 className="font-semibold text-lg mb-4">Create Quiz</h2>
								<form onSubmit={handleCreate} className="space-y-4">
									<div>
										<Label className="mb-1 block">Category</Label>
										<div className="flex flex-wrap gap-2">
											{categoryOptions.map(({ value, label }) => (
												<button
													key={value}
													type="button"
													onClick={()=>setForm(f=>({...f,category:value}))}
													className={`px-3 py-1 rounded-full text-xs border ${form.category===value?'bg-indigo-600 text-white border-indigo-600':'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
												>
													{label}
												</button>
											))}
										</div>
									</div>
									<div className="grid md:grid-cols-2 gap-4">
										<div>
											<Label>Title</Label>
											<Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Daily Quiz" required />
										</div>
										<div>
											<Label>Prize Type</Label>
											<div className="flex gap-2 mt-1">
												{['money','coins','others'].map(pt=> (
													<button type="button" key={pt} onClick={()=>setForm(f=>({...f,prize_type:pt}))} className={`px-2 py-1 rounded text-xs border ${form.prize_type===pt?'bg-indigo-600 text-white border-indigo-600':'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{pt}</button>
												))}
											</div>
										</div>
									</div>
									<div className="grid md:grid-cols-3 gap-2">
										{form.prizes.map((p,i)=> (
											<Input key={i} value={p} placeholder={`${i+1}${['st','nd','rd'][i]||'th'} Prize`} onChange={e=>setForm(f=>{ const prizes=[...f.prizes]; prizes[i]=e.target.value; return {...f, prizes}; })} />
										))}
									</div>
									<div className="grid md:grid-cols-2 gap-4">
										<div>
											<Label>Start Time</Label>
											<Input type="datetime-local" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} required />
										</div>
										<div>
											<Label>End Time</Label>
											<Input type="datetime-local" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} required />
										</div>
									</div>
									<div>
										<Label>Questions Mode</Label>
										<div className="flex gap-2 mt-1">
											{['form','paste'].map(mo => (
												<button key={mo} type="button" onClick={()=>setEntryMode(mo)} className={`px-3 py-1 rounded text-xs border ${entryMode===mo? 'bg-indigo-600 text-white border-indigo-600':'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{mo}</button>
											))}
										</div>
									</div>
									{entryMode==='form' ? (
										<div className="space-y-3">
											<p className="text-xs text-gray-600">{opinion? 'Opinion: no correct option stored.' : 'Mark one correct option with radio.'}</p>
											{drafts.map((q,qi)=> (
												<div key={qi} className="border border-gray-200 rounded p-3 space-y-2 bg-white">
													<div className="flex gap-2 items-center">
														<span className="text-xs text-gray-500 w-6">Q{qi+1}</span>
														<Input value={q.text} onChange={e=>setDrafts(ds=>{ const arr=[...ds]; arr[qi]={...arr[qi], text:e.target.value}; return arr; })} placeholder="Question text" className="flex-1" />
														<Button type="button" variant="outline" size="sm" className="border-red-300 text-red-500" onClick={()=> setDrafts(ds=> ds.length===1? [blankQuestion()] : ds.filter((_,i)=>i!==qi))}>Del</Button>
													</div>
													{(q.options||[]).slice(0,4).map((opt,oi)=>(
														<div key={oi} className="flex items-center gap-2">
															{!opinion && <input type="radio" name={`q-${qi}`} checked={(q.correctIndex||0)===oi} onChange={()=> setDrafts(ds=>{ const arr=[...ds]; arr[qi]={...arr[qi], correctIndex:oi}; return arr; })} />}
															<Input value={opt} onChange={e=> setDrafts(ds=>{ const arr=[...ds]; const ops=[...arr[qi].options]; ops[oi]=e.target.value; arr[qi]={...arr[qi], options:ops}; return arr; })} placeholder={`Option ${oi+1}`} className="flex-1" />
															{(q.options||[]).length>2 && (
																<Button type="button" size="sm" variant="outline" className="border-red-300 text-red-500" onClick={()=> setDrafts(ds=>{ const arr=[...ds]; const ops=[...arr[qi].options]; ops.splice(oi,1); arr[qi]={...arr[qi], options:ops}; return arr; })}>X</Button>
															)}
														</div>
													))}
													<div className="flex gap-2 items-center">
														<Button type="button" size="sm" disabled={(q.options||[]).length>=4} onClick={()=> setDrafts(ds=>{ const arr=[...ds]; const ops=[...arr[qi].options]; if(ops.length<4) ops.push(''); arr[qi]={...arr[qi], options:ops}; return arr; })}><Plus className="w-4 h-4 mr-1"/>Option</Button>
														<span className="text-xs text-gray-500">Max 4 options</span>
													</div>
												</div>
											))}
											<Button type="button" onClick={()=> setDrafts(d=>[...d, blankQuestion()])}><Plus className="w-4 h-4 mr-1"/>Question</Button>
										</div>
									) : (
										<div className="space-y-2">
											<Label>Paste Questions</Label>
											<Textarea className="h-40" value={form.bulk} onChange={e=> setForm(f=>({...f, bulk:e.target.value}))} placeholder={`Q1. Capital of India?\n- [ ] Mumbai\n- [x] Delhi\n- [ ] Kolkata\n- [ ] Jaipur\n\nQ2. ...`}/>
											{(() => { const {items, errors, warnings} = parseBulk(form.bulk, { allowZeroCorrect: opinion }); return (
												<div className="text-xs space-y-1">
													<div>{items.length} parsed</div>
													{warnings[0] && <div className="text-amber-500">{warnings[0]}</div>}
													{errors[0] && <div className="text-red-500">{errors[0]}</div>}
													<Button type="button" size="sm" disabled={!!errors.length || !items.length} onClick={()=> {
														if (errors.length) return; if (!items.length) return;
														const draft = items.map(it=> ({ text: it.question_text, options: it.options.map(o=>o.option_text), correctIndex: opinion?0: it.options.findIndex(o=>o.is_correct) >=0 ? it.options.findIndex(o=>o.is_correct):0 }));
														setDrafts(draft.length? draft : [blankQuestion()]); setEntryMode('form'); toast({ title:'Loaded', description:`${draft.length} questions moved to form.`});
													}}>Load into form</Button>
												</div>
											); })()}
										</div>
									)}
									<div className="flex gap-3">
										<Button type="submit" className="bg-green-600 hover:bg-green-700">Create</Button>
										<Button type="button" variant="outline" onClick={()=> setShowCreate(false)}>Cancel</Button>
									</div>
								</form>
							</m.div>
						)}
					</AnimatePresence>

					<section>
						<h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><ListChecks className="w-5 h-5"/>All Quizzes</h2>
						{loading ? <div className="py-8 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2"/>Loading...</div> : (
							<div className="space-y-6">
								<div>
									<h3 className="font-medium mb-2">Active / Upcoming</h3>
									<div className="space-y-4">
										{quizBlocks.active.map(q => {
											const prizeType = q.prize_type || 'money';
											const pool = formatPrizeDisplay(prizeType, q.prize_pool, { fallback:0 });
											const prizes = Array.isArray(q.prizes) ? q.prizes.map(p=> formatPrizeDisplay(prizeType,p,{fallback:0})).join(', ') : '';
											return (
												<m.div key={q.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
													<div className="flex justify-between gap-4 flex-wrap">
														<div className="flex-1 min-w-[240px]">
															<h4 className="font-semibold">{q.title}</h4>
															<div className="text-xs text-gray-600 flex flex-wrap gap-3 mt-1">
																<span>Category: {getCategoryLabel(q.category)||'—'}</span>
																<span>Type: {prizeType}</span>
																<span>Pool: {pool}</span>
																<span>Prizes: {prizes}</span>
															</div>
															<div className="text-xs text-gray-500 mt-1">
																<span>Start: {q.start_time? formatDateTime(q.start_time):'—'}</span>
																<span className="ml-4">End: {q.end_time? formatDateTime(q.end_time):'—'}</span>
															</div>
														</div>
														<div className="flex gap-2 items-start">
															<Button size="sm" variant="outline" onClick={()=> recompute(q.id)} disabled={busyQuizId===q.id}>{busyQuizId===q.id? <><Loader2 className="w-4 h-4 mr-1 animate-spin"/>...</> : <><RefreshCcw className="w-4 h-4 mr-1"/>Recompute</>}</Button>
															<Link to={`/results/${q.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100 text-indigo-600"><Eye className="w-4 h-4"/>Results</Link>
															<Button size="sm" variant="outline" onClick={()=> { setSelectedQuiz(q); fetchQuestions(q.id); setShowQuestions(true); }} className="text-blue-400"><Settings className="w-4 h-4 mr-1"/>Questions</Button>
															<Button size="sm" variant="outline" onClick={()=> deleteQuiz(q.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></Button>
														</div>
													</div>
													<AnimatePresence>
														{showQuestions && selectedQuiz?.id===q.id && (
															<m.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="mt-4 space-y-2">
																<h5 className="font-medium flex items-center gap-2">Questions for {q.title}</h5>
																{questions.length===0 && <div className="text-xs text-gray-500">No questions.</div>}
																{questions.map((ques,i)=>(
																	<div key={ques.id} className="border border-gray-200 rounded p-3 bg-white">
																		<div className="text-sm font-medium">Q{i+1}: {ques.question_text}</div>
																		<div className="flex flex-wrap gap-2 mt-1">
																			{(ques.options||[]).map(o=> (
																				<div key={o.id} className={`px-2 py-0.5 text-xs rounded-full ${o.is_correct ? 'bg-green-600 text-white':'bg-gray-200 text-gray-700'}`}>{o.option_text}{o.is_correct && <span className="ml-1">✓</span>}</div>
																			))}
																		</div>
																	</div>
																))}
															</m.div>
														)}
													</AnimatePresence>
												</m.div>
											);
										})}
									</div>
								</div>
								<div>
									<h3 className="font-medium mb-2">Finished</h3>
									<div className="space-y-4">
										{quizBlocks.finished.map(q => {
											const prizeType = q.prize_type || 'money';
											const pool = formatPrizeDisplay(prizeType, q.prize_pool, { fallback:0 });
											const prizes = Array.isArray(q.prizes) ? q.prizes.map(p=> formatPrizeDisplay(prizeType,p,{fallback:0})).join(', ') : '';
											return (
												<m.div key={q.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
													<h4 className="font-semibold">{q.title}</h4>
													<div className="text-xs text-gray-600 flex flex-wrap gap-3 mt-1">
														<span>Category: {getCategoryLabel(q.category)||'—'}</span>
														<span>Type: {prizeType}</span>
														<span>Pool: {pool}</span>
														<span>Prizes: {prizes}</span>
													</div>
												</m.div>
											);
										})}
									</div>
								</div>
							</div>
						)}
					</section>
				</div>
			)}
			{tab==='approvals' && (
				<div className="space-y-6">
					<h2 className="text-lg font-semibold">Pending Redemptions</h2>
					<div className="text-sm text-gray-600">Approve user reward payouts after verifying their UPI ID / phone number.</div>
					{loadingRedemptions && (
						<div className="py-8 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2"/>Loading pending requests...</div>
					)}
					{!loadingRedemptions && pendingRedemptions.length===0 && (
						<div className="py-6 text-center text-gray-500 border border-gray-200 rounded-xl bg-gray-50">No pending redemptions.</div>
					)}
					{pendingRedemptions.length>0 && (
						<div className="space-y-4">
							{pendingRedemptions.map(r => (
								<div key={r.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col md:flex-row md:items-center gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-semibold shadow">
												<span className="text-sm">₹</span>
											</div>
											{(() => { 
												const rawVal = r.reward_value;
												const displayVal = rawVal && String(rawVal).trim().length ? rawVal : `${r.reward_type||''}`.trim() || 'Reward';
												const username = r.profiles?.username || r.profiles?.full_name || 'Anonymous';
												return (
													<div>
														<div className="text-sm font-semibold text-gray-900 truncate">{displayVal}</div>
														<div className="text-[11px] text-gray-600">@{username}</div>
													</div>
												);
											})()}
										</div>
										<div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-3">
											<span>Type: {r.reward_type || '—'}</span>
											<span>Coins: {r.coins_required ?? 0}</span>
											<span>Requested: {r.requested_at ? formatDateTime(r.requested_at) : '—'}</span>
										</div>
										<div className="mt-1 text-xs text-gray-500">Payout: {r.payout_identifier ? `${r.payout_identifier} (${r.payout_channel||'upi'})` : '—'}</div>
									</div>
									<div className="flex items-center gap-2 self-start md:self-center">
										<Button size="sm" onClick={()=> approveRedemption(r.id)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
			{tab==='notifications' && (
				<NotificationsPanel />
			)}
			{tab==='automation' && (
				<AutomationPanel />
			)}
			{tab==='rewards' && (
				<RewardsPanel />
			)}
		</div>
	);
}

// ---------------- Rewards Catalog Panel ----------------
function RewardsPanel() {
	const { toast } = useToast();
	// Only Rewards Catalog management is shown in this panel (no approval/rejection/history)
	const [rewards, setRewards] = React.useState([]);
	const [rewardsLoading, setRewardsLoading] = React.useState(false);
	const [showNewReward, setShowNewReward] = React.useState(false);
	// rewardForm fields: reward_type (text), reward_value (text), coins_required (int), is_active (bool)
	const [rewardForm, setRewardForm] = React.useState({ reward_type:'coins', reward_value:'', coins_required:'', is_active:true });
	const [savingReward, setSavingReward] = React.useState(false);
	const [editingId, setEditingId] = React.useState(null);


	const loadRewards = React.useCallback(async ()=> {
		if (!supabase) return; setRewardsLoading(true);
		const { data, error } = await supabase
			.from('reward_catalog')
			.select('id,reward_type,reward_value,coins_required,is_active')
			.order('id', { ascending:false })
			.limit(200);
		if (error) toast({ title:'Rewards load failed', description:error.message, variant:'destructive'}); else setRewards(data||[]);
		setRewardsLoading(false);
	},[toast]);

	React.useEffect(() => { loadRewards(); }, [loadRewards]);

	// Approval flow handled separately in Approvals tab. This panel only manages active reward catalog entries.

	const resetRewardForm = () => setRewardForm({ reward_type:'cash', reward_value:'', coins_required:'', is_active:true });
	const saveReward = async e => {
		e.preventDefault(); if(!supabase) return; setSavingReward(true);
		try {
			const payload = {
				reward_type: String(rewardForm.reward_type||'').trim() || 'cash',
				reward_value: String(rewardForm.reward_value||'').trim(),
				coins_required: rewardForm.coins_required!=='' && rewardForm.coins_required!==null ? parseInt(rewardForm.coins_required,10) : null,
				is_active: !!rewardForm.is_active,
			};
			if (!payload.reward_value) throw new Error('Value required');
			if (payload.coins_required === null || Number.isNaN(payload.coins_required)) throw new Error('Coins required');
			let resp;
			if (editingId) resp = await supabase.from('reward_catalog').update(payload).eq('id', editingId).select().single();
			else resp = await supabase.from('reward_catalog').insert([payload]).select().single();
			if (resp.error) throw resp.error;
			toast({ title: editingId? 'Reward updated':'Reward created' });
			resetRewardForm(); setShowNewReward(false); setEditingId(null); loadRewards();
		} catch(e){ toast({ title:'Save failed', description:e.message, variant:'destructive'});} finally { setSavingReward(false); }
	};

	const toggleRewardActive = async r => {
		if (!supabase) return; const { error } = await supabase.from('reward_catalog').update({ is_active: !r.is_active }).eq('id', r.id);
		if (error) toast({ title:'Toggle failed', description:error.message, variant:'destructive'}); else { toast({ title: r.is_active? 'Deactivated':'Activated' }); loadRewards(); }
	};

	const beginEdit = r => {
		setEditingId(r.id);
		setShowNewReward(true);
		setRewardForm({
			reward_type: r.reward_type || 'cash',
			reward_value: r.reward_value || '',
			coins_required: (r.coins_required ?? '').toString(),
			is_active: !!r.is_active,
		});
	};

	// Reject flow removed as well.

	return (
		<div className="space-y-6">
			<p className="text-xs text-gray-500">Redemptions auto-approved hain. Neeche sirf Rewards Catalog manage karna hai.</p>

			{/* Rewards Catalog Management */}
			<div className="pt-10 border-t border-gray-200 space-y-4">
				<div className="flex items-center gap-3 flex-wrap">
					<h2 className="font-semibold text-lg">Rewards Catalog</h2>
					<Button size="sm" onClick={()=> { setShowNewReward(s=>!s); if(!showNewReward){ resetRewardForm(); setEditingId(null);} }}>{showNewReward? 'Close':'New Reward'}</Button>
					<Button size="sm" variant="outline" onClick={loadRewards} disabled={rewardsLoading}>{rewardsLoading? <Loader2 className="w-4 h-4 animate-spin"/>:'Refresh'}</Button>
				</div>
				{showNewReward && (
					<form onSubmit={saveReward} className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-3xl">
						<div className="grid md:grid-cols-3 gap-4">
							<div>
								<Label>Type</Label>
								<div className="flex gap-2 flex-wrap mt-1">
									{['cash','voucher'].map(k=> (
										<button type="button" key={k} onClick={()=> setRewardForm(f=>({...f,reward_type:k}))} className={`px-2 py-1 rounded text-xs border ${rewardForm.reward_type===k? 'bg-indigo-600 text-white border-indigo-600':'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
											{k === 'cash' ? '💵 Cash (UPI/Phone)' : '🎟️ Voucher (WhatsApp)'}
										</button>
									))}
								</div>
								<p className="text-xs text-gray-500 mt-1">
									{rewardForm.reward_type === 'cash' ? 'User will provide UPI ID or Phone number' : 'User will provide WhatsApp number'}
								</p>
							</div>
							<div>
								<Label>Value</Label>
								<Input value={rewardForm.reward_value} onChange={e=> setRewardForm(f=>({...f,reward_value:e.target.value}))} placeholder="e.g. 100 / AMAZON100 / ₹100" />
							</div>
							<div>
								<Label>Coins Required</Label>
								<Input type="number" value={rewardForm.coins_required} onChange={e=> setRewardForm(f=>({...f,coins_required:e.target.value}))} placeholder="coins needed" />
							</div>
							<div className="flex items-center gap-2">
								<input id="is_active" type="checkbox" checked={!!rewardForm.is_active} onChange={e=> setRewardForm(f=>({...f,is_active:e.target.checked}))} />
								<label htmlFor="is_active" className="text-sm">Active</label>
							</div>
						</div>
						<div className="flex gap-2">
							<Button type="submit" disabled={savingReward}>{savingReward? <><Loader2 className="w-4 h-4 mr-1 animate-spin"/>Saving</> : (editingId? 'Update':'Create')}</Button>
							<Button type="button" variant="outline" onClick={()=> { resetRewardForm(); setEditingId(null); }}>{editingId? 'Cancel Edit':'Reset'}</Button>
						</div>
					</form>
				)}
				<div className="overflow-x-auto rounded-lg border border-gray-200">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-100 text-gray-700">
							<tr>
								<th className="p-2 text-left">Type</th>
								<th className="p-2 text-left">Value</th>
								<th className="p-2 text-left">Coins Required</th>
								<th className="p-2 text-left">Active</th>
								<th className="p-2 text-left">Actions</th>
							</tr>
						</thead>
						<tbody>
							{rewards.map(r=> (
								<tr key={r.id} className="border-t border-gray-200 hover:bg-gray-100">
									<td className="p-2 capitalize">{r.reward_type}</td>
									<td className="p-2 max-w-[260px] truncate" title={r.reward_value}>{r.reward_value}</td>
									<td className="p-2">{r.coins_required ?? '—'}</td>
									<td className="p-2">{r.is_active? <span className="text-green-500">Yes</span>: <span className="text-gray-500">No</span>}</td>
									<td className="p-2">
										<div className="flex gap-2 flex-wrap">
											<Button size="sm" variant="outline" onClick={()=> beginEdit(r)}>Edit</Button>
											<Button size="sm" variant="outline" onClick={()=> toggleRewardActive(r)}>{r.is_active? 'Deactivate':'Activate'}</Button>
										</div>
									</td>
								</tr>
							))}
								{!rewards.length && !rewardsLoading && (
									<tr><td colSpan={8} className="p-4 text-center text-gray-500">No rewards.</td></tr>
								)}
								{rewardsLoading && (
									<tr><td colSpan={8} className="p-6 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2"/>Loading rewards...</td></tr>
								)}
						</tbody>
					</table>
				</div>
				<p className="text-xs text-gray-500">Catalog: inactive rewards are hidden from users.</p>
			</div>
		</div>
	);
}

// ---------------- Notifications Panel ----------------
function NotificationsPanel() {
	const { toast } = useToast();
	const [title, setTitle] = React.useState('');
	const [message, setMessage] = React.useState('');
	const [segment, setSegment] = React.useState('all'); // future: category or quiz specific
	const [sending, setSending] = React.useState(false);
	const [list, setList] = React.useState([]);
	const [loading, setLoading] = React.useState(false);

	const load = React.useCallback(async () => {
		if (!supabase) return; setLoading(true);
		const { data, error } = await supabase.from('notifications').select('id,title,message,type,segment,created_at').order('created_at', { ascending:false }).limit(100);
		if (error) toast({ title:'Fetch failed', description:error.message, variant:'destructive'}); else setList(data||[]);
		setLoading(false);
	}, [toast]);

	React.useEffect(()=>{ load(); },[load]);

		const send = async e => {
		e.preventDefault();
		if (!title.trim() || !message.trim()) { toast({ title:'Missing fields', variant:'destructive'}); return; }
		if (!supabase) { toast({ title:'No backend client', variant:'destructive'}); return; }
		setSending(true);
		try {
			const payload = { title: title.trim(), message: message.trim(), segment };
			// Route via Supabase client so we hit the deployed edge function even off-origin
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData?.session?.access_token;
			const { data, error } = await supabase.functions.invoke('send-notifications', {
				body: payload,
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			});
			if (error) {
				throw new Error(error.message || error.error || 'Failed to send notification');
			}
			const responseMessage = typeof data === 'object' && data?.message ? data.message : title.trim();
			toast({ title:'Sent', description: responseMessage });
			setTitle(''); setMessage('');
			load();
		} catch (e) {
			toast({ title:'Send failed', description:e.message, variant:'destructive'});
		} finally { setSending(false); }
	};

	return (
		<div className="space-y-8 max-w-3xl">
			<form onSubmit={send} className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-5">
				<h2 className="font-semibold text-lg">Send Notification</h2>
				<div>
					<Label htmlFor="notification-title">Title</Label>
					<Input
						id="notification-title"
						name="notificationTitle"
						value={title}
						onChange={e=> setTitle(e.target.value)}
						maxLength={80}
						placeholder="Short title"
					/>
					<div className="text-[10px] text-gray-500 mt-1">Max 80 chars • {title.length}/80</div>
				</div>
				<div>
					<Label htmlFor="notification-message">Message</Label>
					<Textarea
						id="notification-message"
						name="notificationMessage"
						value={message}
						onChange={e=> setMessage(e.target.value)}
						className="h-28"
						maxLength={280}
						placeholder="Body shown in push notification"
					/>
					<div className="text-[10px] text-gray-500 mt-1">Max 280 chars • {message.length}/280</div>
				</div>
				<div>
					<Label>Segment</Label>
					<div className="flex gap-2 mt-1">
						{['all'].map(seg => (
							<button type="button" key={seg} onClick={()=> setSegment(seg)} className={`px-3 py-1 rounded text-xs border ${segment===seg? 'bg-indigo-600 text-white border-indigo-600':'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{seg}</button>
						))}
					</div>
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={sending}>{sending? <><Loader2 className="w-4 h-4 mr-1 animate-spin"/>Sending</> : 'Send'}</Button>
					<Button type="button" variant="outline" onClick={()=> { setTitle(''); setMessage(''); }}>Reset</Button>
				</div>
			</form>
			<section>
				<div className="flex items-center gap-3 mb-3">
					<h2 className="font-semibold text-lg">Recent Notifications</h2>
					<Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading? <Loader2 className="w-4 h-4 animate-spin"/> : 'Refresh'}</Button>
				</div>
				<div className="space-y-3">
					{list.map(n => (
						<div key={n.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
							<div className="flex justify-between gap-4 flex-wrap">
								<div>
									<div className="font-medium text-sm">{n.title}</div>
									<div className="text-xs text-gray-600 whitespace-pre-wrap max-w-xl break-words">{n.message}</div>
								</div>
								<div className="text-[10px] text-gray-500">{formatDateTime(n.created_at)}</div>
							</div>
							<div className="text-[10px] text-gray-500 mt-1">Segment: {n.segment || '—'}{n.type? ` • ${n.type}`:''}</div>
						</div>
					))}
					{!list.length && !loading && <div className="text-xs text-gray-500">No notifications yet.</div>}
				</div>
			</section>
		</div>
	);
}

// ---------------- Automation (AI) Panel ----------------
function AutomationPanel() {
	const { toast } = useToast();
	const [loading, setLoading] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [settings, setSettings] = React.useState({ is_enabled: true, cadence_min: 10, live_window_min: 7, start_offset_sec: 15, cleanup_days: 3, categories: ['opinion','gk','sports','movies'], alert_emails: ['quizdangalofficial@gmail.com'] });
	const [providers, setProviders] = React.useState([]);
	const [provForm, setProvForm] = React.useState({ id: null, name: '', api_key_enc: '', priority: 1, enabled: true });

	// Reset quota flags for enabled providers (useful after temporary rate limits)
	const resetQuotaFlags = async () => {
		if (!supabase) return;
		try {
			const { error } = await supabase
				.from('ai_providers')
				.update({ quota_exhausted: false, last_error: null })
				.eq('enabled', true);
			if (error) throw error;
			toast({ title: 'Quota flags reset', description: 'Enabled providers can be retried now.' });
			load();
		} catch (e) {
			toast({ title: 'Reset failed', description: e.message, variant: 'destructive' });
		}
	};

	const load = React.useCallback(async () => {
		if (!supabase) return; setLoading(true);
		try {
			const [{ data: setRow, error: sErr }, { data: provs, error: pErr }] = await Promise.all([
				supabase.from('ai_settings').select('*').eq('id', 1).maybeSingle(),
				supabase.from('ai_providers').select('*').order('enabled', { ascending: false }).order('priority', { ascending: true }).order('id', { ascending: true }),
			]);
			if (sErr) throw sErr; if (pErr) throw pErr;
			if (setRow) setSettings({
				is_enabled: !!setRow.is_enabled,
				cadence_min: setRow.cadence_min ?? 10,
				live_window_min: setRow.live_window_min ?? 7,
				start_offset_sec: setRow.start_offset_sec ?? 15,
				cleanup_days: setRow.cleanup_days ?? 3,
				categories: Array.isArray(setRow.categories) ? setRow.categories : ['opinion','gk','sports','movies'],
				alert_emails: Array.isArray(setRow.alert_emails) ? setRow.alert_emails : ['quizdangalofficial@gmail.com'],
			});
			setProviders(provs || []);
		} catch (e) {
			toast({ title: 'Load failed', description: e.message, variant: 'destructive' });
		} finally { setLoading(false); }
	}, [toast]);

	React.useEffect(() => { load(); }, [load]);

	const saveSettings = async (e) => {
		e?.preventDefault?.(); if (!supabase) return; setSaving(true);
		try {
			const payload = {
				id: 1,
				is_enabled: !!settings.is_enabled,
				cadence_min: Number(settings.cadence_min || 10),
				live_window_min: Number(settings.live_window_min || 7),
				start_offset_sec: Number(settings.start_offset_sec ?? 15),
				categories: settings.categories,
				cleanup_days: Number(settings.cleanup_days || 3),
				alert_emails: settings.alert_emails,
			};
			const { error } = await supabase.from('ai_settings').upsert(payload, { onConflict: 'id' });
			if (error) throw error;
			toast({ title: 'Settings saved' });
		} catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
		finally { setSaving(false); }
	};

	const toggleProvider = async (p) => {
		if (!supabase) return;
		const { error } = await supabase.from('ai_providers').update({ enabled: !p.enabled }).eq('id', p.id);
		if (error) toast({ title: 'Toggle failed', description: error.message, variant: 'destructive' }); else { toast({ title: p.enabled ? 'Disabled' : 'Enabled' }); load(); }
	};

	const saveProvider = async (e) => {
		e?.preventDefault?.(); if (!supabase) return;
		try {
			const base = {
				name: String(provForm.name || '').trim(),
				api_key_enc: String(provForm.api_key_enc || '').trim() || null,
				priority: Number(provForm.priority || 1),
				enabled: !!provForm.enabled,
			};
			if (!base.name) throw new Error('Provider name required');
			let resp;
			if (provForm.id) resp = await supabase.from('ai_providers').update(base).eq('id', provForm.id).select().single();
			else resp = await supabase.from('ai_providers').insert([base]).select().single();
			if (resp.error) throw resp.error;
			toast({ title: provForm.id ? 'Provider updated' : 'Provider added' });
			setProvForm({ id: null, name: '', api_key_enc: '', priority: 1, enabled: true });
			load();
		} catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
	};

	const editProvider = (p) => setProvForm({ id: p.id, name: p.name || '', api_key_enc: p.api_key_enc || '', priority: p.priority || 1, enabled: !!p.enabled });

	return (
		<div className="space-y-6">
			<h2 className="text-lg font-semibold">AI Automation</h2>
			<p className="text-sm text-gray-600">Auto-generate quizzes backend-only. Configure cadence (minutes) and live window (minutes). For 5-minute quizzes with 5-minute gaps, set cadence=10 and live window=5. Each quiz has 4 options per question.</p>

			<form onSubmit={saveSettings} className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-3xl">
				<div className="flex items-center gap-2">
					<input id="is_enabled" type="checkbox" checked={!!settings.is_enabled} onChange={e=> setSettings(s=> ({ ...s, is_enabled: e.target.checked }))} />
					<label htmlFor="is_enabled" className="text-sm">Enabled</label>
				</div>
								<div className="grid md:grid-cols-5 gap-3">
					<div>
						<Label>Cadence (min)</Label>
						<Input type="number" min={1} max={60} value={settings.cadence_min} onChange={e=> setSettings(s=> ({ ...s, cadence_min: e.target.valueAsNumber || 10 }))} />
					</div>
					<div>
						<Label>Live window (min)</Label>
						<Input type="number" min={5} max={180} value={settings.live_window_min} onChange={e=> setSettings(s=> ({ ...s, live_window_min: e.target.valueAsNumber || 7 }))} />
					</div>
					<div>
										<Label>Start offset (sec)</Label>
										<Input type="number" min={0} max={120} value={settings.start_offset_sec} onChange={e=> setSettings(s=> ({ ...s, start_offset_sec: Math.max(0, e.target.valueAsNumber ?? 15) }))} />
									</div>
									<div>
						<Label>Cleanup days</Label>
						<Input type="number" min={1} max={30} value={settings.cleanup_days} onChange={e=> setSettings(s=> ({ ...s, cleanup_days: e.target.valueAsNumber || 3 }))} />
					</div>
									<div className="md:col-span-2">
						<Label>Categories (comma)</Label>
						<Input value={(settings.categories || []).join(', ')} onChange={e=> setSettings(s=> ({ ...s, categories: e.target.value.split(',').map(x=> x.trim()).filter(Boolean) }))} />
					</div>
				</div>
				<div>
					<Label>Alert emails (comma)</Label>
					<Input value={(settings.alert_emails || []).join(', ')} onChange={e=> setSettings(s=> ({ ...s, alert_emails: e.target.value.split(',').map(x=> x.trim()).filter(Boolean) }))} />
				</div>
				<div className="flex gap-2">
					<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
					<Button type="button" variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
				</div>
			</form>

			<div className="space-y-3">
				<div className="flex items-center gap-3 flex-wrap">
					<h3 className="font-semibold">Providers</h3>
					<Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
					<Button size="sm" variant="outline" onClick={resetQuotaFlags}>Reset quota flags</Button>
				</div>
				{/* Move Add/Edit Provider form to the top */}
				<form onSubmit={saveProvider} className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-3xl">
					<h4 className="font-medium">{provForm.id ? 'Edit Provider' : 'Add Provider'}</h4>
					<div className="grid md:grid-cols-4 gap-3">
						<div className="md:col-span-2">
							<Label>Name</Label>
							<Input value={provForm.name} onChange={e=> setProvForm(f=> ({ ...f, name: e.target.value }))} placeholder="e.g. openai" />
						</div>
						<div>
							<Label>Priority</Label>
							<Input type="number" value={provForm.priority} onChange={e=> setProvForm(f=> ({ ...f, priority: e.target.valueAsNumber || 1 }))} />
						</div>
						<div className="flex items-center gap-2">
							<input id="prov_enabled" type="checkbox" checked={!!provForm.enabled} onChange={e=> setProvForm(f=> ({ ...f, enabled: e.target.checked }))} />
							<label htmlFor="prov_enabled" className="text-sm">Enabled</label>
						</div>
						<div className="md:col-span-4">
							<Label>API Key (stored server-side)</Label>
							<Input value={provForm.api_key_enc} onChange={e=> setProvForm(f=> ({ ...f, api_key_enc: e.target.value }))} placeholder="sk-..." />
						</div>
					</div>
					<div className="flex gap-2">
						<Button type="submit">{provForm.id ? 'Update' : 'Add'}</Button>
						<Button type="button" variant="outline" onClick={()=> setProvForm({ id: null, name: '', api_key_enc: '', priority: 1, enabled: true })}>Reset</Button>
					</div>
				</form>
				<div className="overflow-x-auto rounded border border-gray-200">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-100">
							<tr>
								<th className="p-2 text-left">Name</th>
								<th className="p-2 text-left">Priority</th>
								<th className="p-2 text-left">Enabled</th>
								<th className="p-2 text-left">Quota</th>
								<th className="p-2 text-left">Last Error</th>
								<th className="p-2 text-left">Actions</th>
							</tr>
						</thead>
						<tbody>
							{providers.map((p)=> (
								<tr key={p.id} className="border-t border-gray-200">
									<td className="p-2">{p.name}</td>
									<td className="p-2">{p.priority}</td>
									<td className="p-2">{p.enabled ? 'Yes' : 'No'}</td>
									<td className="p-2">{p.quota_exhausted ? 'Exhausted' : 'OK'}</td>
									<td className="p-2 max-w-[300px] truncate" title={p.last_error || ''}>{p.last_error || '—'}</td>
									<td className="p-2">
										<div className="flex gap-2 flex-wrap">
											<Button size="sm" variant="outline" onClick={()=> editProvider(p)}>Edit</Button>
											<Button size="sm" variant="outline" onClick={()=> toggleProvider(p)}>{p.enabled ? 'Disable' : 'Enable'}</Button>
										</div>
									</td>
								</tr>
							))}
							{!providers.length && (
								<tr><td colSpan={6} className="p-4 text-center text-gray-500">No providers</td></tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}