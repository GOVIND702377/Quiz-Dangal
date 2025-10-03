import React from 'react';
import SEO from '@/components/SEO';

export default function PlayWinQuiz() {
  const canonical = 'https://quizdangal.com/play-win-quiz-app';
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Play & Win Quiz App – Quiz Dangal"
        description="Play daily quizzes, climb leaderboards, and win rewards. Opinion-based and GK quizzes made for India – start free on Quiz Dangal."
        canonical={canonical}
        keywords={["play and win quiz", "daily quiz India", "quiz app rewards", "leaderboards", "quizdangal"]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">Play & Win Quiz App</h1>
        <p className="text-slate-300 max-w-3xl">Compete in daily quizzes, earn coins, and track your progress on live leaderboards. Quiz Dangal is built for India with opinion-based and GK rounds that are fun and fair.</p>
        <ul className="list-disc pl-6 text-slate-300 space-y-2">
          <li>Fast rounds and instant results</li>
          <li>Earn coins, redeem rewards</li>
          <li>Secure and fair gameplay</li>
        </ul>
      </div>
    </div>
  );
}
