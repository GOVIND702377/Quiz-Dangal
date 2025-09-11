import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles } from 'lucide-react';

export default function StreakModal({ open, onClose, streakDay, coinsEarned }) {
  const coins = Number.isFinite(Number(coinsEarned)) ? Number(coinsEarned) : 0;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="relative max-w-md w-full rounded-2xl border border-indigo-700/60 bg-gradient-to-br from-indigo-950/60 via-violet-950/50 to-fuchsia-950/50 shadow-2xl overflow-hidden backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-200/40 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-indigo-200/40 blur-3xl" />
            </div>

            <div className="p-6 text-center relative">
              <motion.div
                initial={{ scale: 0.8, rotate: -10, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg"
              >
                <Flame className="w-9 h-9 text-white drop-shadow" />
              </motion.div>

              <h3 className="mt-4 text-2xl font-extrabold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Daily Streak!
              </h3>
              <p className="mt-2 text-slate-200">
                You are on day <span className="font-semibold text-indigo-200">{streakDay}</span> 🔥
              </p>

              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-900/30 text-amber-200 border border-amber-500/40">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold">+{coins} coins</span>
              </div>

              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-semibold shadow hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                >
                  Awesome!
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}