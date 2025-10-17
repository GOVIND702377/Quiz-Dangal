import React from 'react';
import SEO from '@/components/SEO';

export default function OpinionQuiz() {
  const canonical = 'https://quizdangal.com/opinion-quiz-app';
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is an opinion quiz?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Opinion quizzes are polls where you vote on topics and see how the community responded. There are no wrong answers—just share your view and compare with others.'
        }
      },
      {
        '@type': 'Question',
        name: 'How is scoring done in opinion quizzes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Opinion quizzes have no negative marking. You vote within the timer and see percentage breakdown of all votes after the round ends.'
        }
      },
      {
        '@type': 'Question',
        name: 'Who should play opinion quizzes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Anyone who wants quick fun without pressure, wants to compare views with friends, or wants to warm up before competitive GK rounds.'
        }
      }
    ]
  };
  
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Opinion-Based Quiz App – Quiz Dangal"
        description="Opinion-based quizzes designed for quick fun and fair play. Learn how voting works, how results are shown, and tips to enjoy and improve your outcomes."
        canonical={canonical}
        alternateLocales={['hi_IN','en_US']}
        keywords={["opinion quiz app", "poll quiz india", "real-time results", "quizdangal"]}
        jsonLd={[faqSchema]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">Opinion-Based Quizzes</h1>
        <p className="text-slate-300 max-w-3xl">Opinion quizzes are quick, social, and stress-free. Instead of a single “right” answer, you vote on what you believe or prefer, then see how the community responded. This format is perfect when you want to play for fun, warm up before competitive GK rounds, or compare your choices with friends.</p>

        <h2 className="text-2xl font-semibold text-white">How Voting & Results Work</h2>
        <p className="text-slate-300 max-w-3xl">Each question presents a topic with multiple choices. You vote within the timer, and once the round ends, we display a clean breakdown showing percentage of votes per option. No negative marking, no trick questions—just a fast pulse on what people think. Revisit past rounds to see how opinions shift over time.</p>

        <h2 className="text-2xl font-semibold text-white">Why Players Love Opinion Quizzes</h2>
        <ul className="list-disc pl-6 text-slate-300 space-y-2 max-w-3xl">
          <li>Zero pressure: there’s no “wrong” answer to your opinion.</li>
          <li>Instant insight: see live trends and compare with friends.</li>
          <li>Great warm-up: get comfortable before GK or competitive rounds.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-white">Next Steps</h2>
        <p className="text-slate-300 max-w-3xl">After you try a few opinion rounds, switch to our <a href="/play-win-quiz-app" className="text-indigo-300 underline">Play & Win</a> format to chase higher scores. Don’t forget to invite your friends via <a href="/refer-earn-quiz-app" className="text-indigo-300 underline">Refer & Earn</a> and check the <a href="/leaderboards" className="text-indigo-300 underline">Leaderboards</a> to see where you stand.</p>

        <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Highlights</h3>
          <ul className="list-disc pl-6 text-slate-300 space-y-1">
            <li>Real-time vote breakdown</li>
            <li>No negative marking or pressure</li>
            <li>New topics daily</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
