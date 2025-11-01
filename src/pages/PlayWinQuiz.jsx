import React from 'react';
import SEO from '@/components/SEO';

export default function PlayWinQuiz() {
  const canonical = 'https://quizdangal.com/play-win-quiz-app/';
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Play & Win work on Quiz Dangal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Play & Win lets you compete in daily quizzes across Opinion, GK, Sports, and Movies categories. Answer questions accurately and quickly to earn coins and climb leaderboards.'
        }
      },
      {
        '@type': 'Question',
        name: 'How is scoring calculated in Quiz Dangal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Scores are based on accuracy and response time. Correct answers give more weight than speed. All scoring is transparent and verified server-side to ensure fair play.'
        }
      },
      {
        '@type': 'Question',
        name: 'What are the best tips to win more quizzes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Focus on accuracy first, then speed. Play daily to build streaks, warm up with opinion rounds, and ensure stable internet connection during quizzes.'
        }
      }
    ]
  };
  
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Play & Win Quiz App – Quiz Dangal"
        description="Play daily quizzes, climb leaderboards, and win rewards. Opinion-based and GK quizzes made for India – start free on Quiz Dangal. Learn rules, scoring, and tips to win more."
        canonical={canonical}
        alternateLocales={['hi_IN','en_US']}
        keywords={["play and win quiz", "daily quiz India", "quiz app rewards", "leaderboards", "quizdangal"]}
        jsonLd={[faqSchema]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent pt-14">Play & Win Quiz App</h1>
        <p className="text-slate-300 max-w-3xl">Compete in daily quizzes, earn coins, and track your progress on live leaderboards. Quiz Dangal is built for India with opinion-based and GK rounds that are fun and fair. If you love short, exciting contests you can play between classes or on your daily commute, this guide explains how Play & Win works and how to improve your scores.</p>

        <h2 className="text-2xl font-semibold text-white">How Play & Win Works</h2>
        <p className="text-slate-300 max-w-3xl">Each contest has a small set of questions and a clear timer. Answer as accurately and as quickly as possible to collect coins. You can join public rounds throughout the day, see your ranking on leaderboards, and rejoin future rounds to beat your best. Opinion-based rounds keep the pressure low, while GK rounds test your recall and speed.</p>

        <h2 className="text-2xl font-semibold text-white">Scoring & Fair Play</h2>
        <p className="text-slate-300 max-w-3xl">Scores are calculated transparently. For knowledge quizzes, correct answers give more weight than response time, so accuracy matters. We use anti-cheat checks and server-side verification to ensure fair play. Your total coins reflect your consistent performance across multiple contests, not a single lucky streak.</p>

        <h2 className="text-2xl font-semibold text-white">Tips to Win More</h2>
        <ul className="list-disc pl-6 text-slate-300 space-y-2 max-w-3xl">
          <li>Warm up with opinion rounds to get into the flow without pressure.</li>
          <li>Focus on accuracy first, then speed. Guessing wildly reduces your average.</li>
          <li>Play at steady internet, keep the app updated, and avoid switching apps mid-round.</li>
          <li>Join daily to build streaks and unlock small bonuses over time.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-white">What You Can Do Next</h2>
  <p className="text-slate-300 max-w-3xl">New to Quiz Dangal? Start with the basics on our <a href="/opinion-quiz-app/" className="text-indigo-300 underline">Opinion Quiz</a> explainer. Then jump into categories: <a href="/category/opinion/" className="text-indigo-300 underline">Opinion</a>, <a href="/category/gk/" className="text-indigo-300 underline">GK</a>, <a href="/category/sports/" className="text-indigo-300 underline">Sports</a>, <a href="/category/movies/" className="text-indigo-300 underline">Movies</a>. Invite friends via <a href="/refer-earn-quiz-app/" className="text-indigo-300 underline">Refer & Earn</a>, and browse the <a href="/leaderboards/" className="text-indigo-300 underline">Leaderboards</a> to see top players.</p>

        <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Quick Highlights</h3>
          <ul className="list-disc pl-6 text-slate-300 space-y-1">
            <li>Fast rounds and instant results</li>
            <li>Earn coins and redeem rewards</li>
            <li>Transparent scoring and fair gameplay</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
