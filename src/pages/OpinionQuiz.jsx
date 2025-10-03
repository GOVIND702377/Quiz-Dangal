import React from 'react';
import SEO from '@/components/SEO';

export default function OpinionQuiz() {
  const canonical = 'https://quizdangal.com/opinion-quiz-app';
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Opinion-Based Quiz App – Quiz Dangal"
        description="Opinion-based quizzes designed for quick fun and fair play. Vote, see results in real-time, and challenge friends on Quiz Dangal."
        canonical={canonical}
        keywords={["opinion quiz app", "poll quiz india", "real-time results", "quizdangal"]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">Opinion-Based Quizzes</h1>
        <p className="text-slate-300 max-w-3xl">Vote on trending topics, see how the crowd thinks, and enjoy instant results. Opinion quizzes keep the fun high and the pressure low.</p>
        <ul className="list-disc pl-6 text-slate-300 space-y-2">
          <li>Real-time vote breakdown</li>
          <li>No negative marking pressure</li>
          <li>New topics daily</li>
        </ul>
      </div>
    </div>
  );
}
