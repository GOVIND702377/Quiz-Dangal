import React from 'react';
import SEO from '@/components/SEO';

export default function ReferEarnInfo() {
  const canonical = 'https://quizdangal.com/refer-earn-quiz-app';
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Refer & Earn Quiz App – Quiz Dangal"
        description="Invite friends, they play quizzes, and you both earn. Simple, transparent, and rewarding – try Refer & Earn on Quiz Dangal."
        canonical={canonical}
        keywords={["refer and earn quiz", "invite friends earn coins", "quiz app referral india", "quizdangal refer"]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">Refer & Earn – Quiz Dangal</h1>
        <p className="text-slate-300 max-w-3xl">Share your referral code, your friends join, and both earn coins as they play. No hidden rules, just rewards for bringing the squad!</p>
        <ul className="list-disc pl-6 text-slate-300 space-y-2">
          <li>Simple referral code</li>
          <li>Fair bonus for both</li>
          <li>Track progress in your profile</li>
        </ul>
      </div>
    </div>
  );
}
