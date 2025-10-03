import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Trophy, Users } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function statusBadge(s) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
  if (s === 'active') return base + ' bg-green-600/15 text-green-400 border border-green-700/40';
  if (s === 'upcoming') return base + ' bg-blue-600/15 text-blue-300 border border-blue-700/40';
  if (s === 'finished' || s === 'completed') return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
  return base + ' bg-slate-600/20 text-slate-300 border border-slate-700/40';
}

const CategoryQuizzesModal = ({ open, onClose, category, quizzes, onJoin, joiningId }) => {
  const { isSubscribed, subscribeToPush } = usePushNotifications();

  const list = useMemo(() => {
    const slug = (category || '').toLowerCase();
    return (quizzes || [])
      .filter(q => (q.category || '').toLowerCase() === slug)
      .sort((a,b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));
  }, [quizzes, category]);

  const handleJoinClick = async (q) => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && !isSubscribed) {
        await subscribeToPush();
      }
    } catch { /* ignore */ }
    onJoin?.(q);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative w-full sm:max-w-xl bg-slate-900/95 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold capitalize">{category} Quizzes</h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            {list.length === 0 ? (
              <div className="py-10 text-center text-slate-400">No quizzes in this category yet.</div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {list.map((q) => {
                  const now = Date.now();
                  const st = q.start_time ? new Date(q.start_time).getTime() : null;
                  const et = q.end_time ? new Date(q.end_time).getTime() : null;
                  const isActive = q.status === 'active' && st && et && now >= st && now < et;
                  const isUpcoming = q.status === 'upcoming' && st && now < st;
                  const canJoin = isActive || isUpcoming;
                  const label = joiningId === q.id ? 'JOINING…' : (isActive ? 'PLAY' : (isUpcoming ? 'JOIN' : 'SOON'));
                  const secs = isUpcoming && st ? Math.max(0, Math.floor((st - now)/1000)) : (isActive && et ? Math.max(0, Math.floor((et - now)/1000)) : null);
                  return (
                    <div key={q.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="truncate font-semibold text-slate-100">{q.title}</div>
                            <span className={statusBadge(q.status)}>{q.status}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                            <span className="inline-flex items-center"><Clock className="w-3.5 h-3.5 mr-1" />{q.start_time ? new Date(q.start_time).toLocaleString() : 'Not set'}</span>
                            <span className="inline-flex items-center"><Trophy className="w-3.5 h-3.5 mr-1" />₹{q.prize_pool || 0}</span>
                          </div>
                          {secs !== null && (
                            <div className="mt-1 text-xs text-indigo-300">{isUpcoming ? 'Starts in' : 'Ends in'}: {Math.floor(secs/60).toString().padStart(2,'0')}:{(secs%60).toString().padStart(2,'0')}</div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <button
                            disabled={!canJoin || joiningId === q.id}
                            onClick={() => canJoin && handleJoinClick(q)}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${(!canJoin || joiningId === q.id) ? 'bg-slate-700 text-slate-400 border-slate-700' : (isActive ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600')}`}
                          >
                            {label}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CategoryQuizzesModal;
