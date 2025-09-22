import React from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function StreakModal({ open, onClose, streakDay, coinsEarned, day, coins: coinsProp }) {
  // Backward compatibility: accept both (streakDay, coinsEarned) and (day, coins)
  const dayValRaw = streakDay ?? day;
  const coinsRaw = coinsEarned ?? coinsProp;
  const coins = Number.isFinite(Number(coinsRaw)) ? Number(coinsRaw) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent
        overlayClassName="bg-black/90 backdrop-blur-sm"
        className="w-[calc(100vw-2rem)] max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl p-5 sm:p-6 bg-slate-900 border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* subtle ambient glows to match app visuals */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-accent-b-15 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-accent-c-15 blur-3xl" />
        </div>

        <DialogHeader className="items-center text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
            <Flame className="w-9 h-9 text-white drop-shadow" />
          </div>
          <DialogTitle className="mt-3 text-2xl font-extrabold heading-gradient">
            Daily Streak!
          </DialogTitle>
          <p className="mt-1 text-sm text-white/85">
            You are on day <span className="font-semibold text-accent-b">{dayValRaw}</span> 🔥
          </p>
        </DialogHeader>

        <div className="mt-4 flex items-center justify-center">
          <div className="chip-accent-b px-4 py-2 gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">+{coins} coins</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button variant="brand" onClick={onClose} className="px-5">
            Awesome!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}