import React from 'react';
import SEO from '@/components/SEO';

export default function Landing() {
  const canonical = 'https://quizdangal.com/';
  const faqs = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Quiz Dangal kya hai? Kya sach me rewards milte hain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Quiz Dangal ek opinion aur knowledge based quiz platform hai jahaan aap daily quizzes khel kar coins kama sakte hain aur rewards redeem kar sakte hain.'
        }
      },
      {
        '@type': 'Question',
        name: 'Refer & Earn kaise kaam karta hai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Aap apna referral link share kijiye. Aapke dost sign up karke khelna shuru karte hi aapko bonus coins milte hain.'
        }
      },
      {
        '@type': 'Question',
        name: 'Kya yeh India me legal hai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Haan, yeh skill-based quizzes hain. Hum fair play, anti-cheat aur user safety ke saath operate karte hain.'
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="Quiz Dangal – India Quiz | Play & Win | Refer & Earn"
        description="Join Quiz Dangal – India’s quiz platform for opinion & knowledge games. Play & Win daily, climb leaderboards, Refer & Earn coins. Start free!"
        canonical={canonical}
        keywords={[
          'Quiz Dangal','quizdangal','quiz','india quiz','indiaquiz','moneyquiz','play and win','play & win','opinion quiz','gk quiz','sports quiz','movies quiz','daily quiz India','refer and earn quiz app','online quiz contest','win rewards'
        ]}
        alternateLocales={['hi_IN', 'en_US']}
        jsonLd={[faqs]}
      />

      <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
        <div className="max-w-4xl w-full text-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent">
              Quiz Dangal – India&apos;s Play & Win Quiz App
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto">
              Daily opinion & GK quizzes in Hindi & English. Compete, climb leaderboards, win rewards. Refer friends and earn bonus coins!
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/login" className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg transition">
                Login / Sign Up Free
              </a>
              <a href="/leaderboards" className="px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700 transition">
                View Leaderboards
              </a>
            </div>
          </div>
          {/* Features section with internal links for SEO */}
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-center mb-6 text-white">How Quiz Dangal Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <a href="/play-win-quiz-app" className="block rounded-xl bg-slate-900/60 border border-slate-700/60 p-5 hover:bg-slate-800/60 transition">
                <div className="text-lg font-semibold text-indigo-200 mb-2">🎯 Play & Win</div>
                <p className="text-slate-300 text-sm">Join daily quiz contests across Opinion, GK, Sports & Movies. Win coins based on accuracy and speed.</p>
              </a>
              <a href="/opinion-quiz-app" className="block rounded-xl bg-slate-900/60 border border-slate-700/60 p-5 hover:bg-slate-800/60 transition">
                <div className="text-lg font-semibold text-indigo-200 mb-2">💭 Opinion Quiz</div>
                <p className="text-slate-300 text-sm">Share your views on trending topics. No right or wrong answers—just fun polls with instant results.</p>
              </a>
              <a href="/refer-earn-quiz-app" className="block rounded-xl bg-slate-900/60 border border-slate-700/60 p-5 hover:bg-slate-800/60 transition">
                <div className="text-lg font-semibold text-indigo-200 mb-2">🎁 Refer & Earn</div>
                <p className="text-slate-300 text-sm">Invite friends with your unique code. Both of you get bonus coins when they start playing!</p>
              </a>
            </div>
          </section>
          {/* Why Choose Quiz Dangal */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-center mb-6 text-white">Why Choose Quiz Dangal?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-slate-900/60 border border-slate-700/60 p-6 text-center">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-white mb-2">Fast & Fair</h3>
                <p className="text-slate-300">Transparent scoring, anti-cheat protection, and instant results after every quiz.</p>
              </div>
              <div className="rounded-2xl bg-slate-900/60 border border-slate-700/60 p-6 text-center">
                <div className="text-3xl mb-3">🏆</div>
                <h3 className="text-xl font-bold text-white mb-2">Real Rewards</h3>
                <p className="text-slate-300">Earn coins for every correct answer. Redeem rewards and track your progress on leaderboards.</p>
              </div>
              <div className="rounded-2xl bg-slate-900/60 border border-slate-700/60 p-6 text-center">
                <div className="text-3xl mb-3">🇮🇳</div>
                <h3 className="text-xl font-bold text-white mb-2">Made for India</h3>
                <p className="text-slate-300">Categories Indians love: Opinion, GK, Sports, Movies. Play in Hindi or English anytime.</p>
              </div>
            </div>
          </section>

          {/* CTA and footer links */}
          <section className="mt-12 text-center">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 border border-indigo-700/60 p-8">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to Play?</h2>
              <p className="text-slate-300 mb-5">Join thousands of players competing daily. Sign up free and start winning!</p>
              <a href="/login" className="inline-block px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg transition">
                Join Quiz Dangal Now
              </a>
            </div>
            <nav className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
              <a href="/about-us" className="text-indigo-300 hover:text-indigo-200">About Us</a>
              <a href="/contact-us" className="text-indigo-300 hover:text-indigo-200">Contact</a>
              <a href="/terms-conditions" className="text-indigo-300 hover:text-indigo-200">Terms</a>
              <a href="/privacy-policy" className="text-indigo-300 hover:text-indigo-200">Privacy</a>
            </nav>
          </section>
        </div>
      </div>
    </>
  );
}
