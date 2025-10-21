import React from 'react';
import SEO from '@/components/SEO';

export default function ReferEarnInfo() {
  const canonical = 'https://quizdangal.com/refer-earn-quiz-app/';
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Refer & Earn work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Share your unique referral code or link with friends. When they sign up and complete eligible quizzes, both of you receive bonus coins automatically.'
        }
      },
      {
        '@type': 'Question',
        name: 'When do I get referral bonus?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Bonuses are awarded when your referred friend completes their first few eligible quiz rounds. This prevents abuse and ensures genuine participation.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I use multiple referral codes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No, each player can only use one referral code during sign-up to maintain fairness.'
        }
      }
    ]
  };
  
  return (
    <div className="min-h-screen text-slate-100">
      <SEO
        title="Refer & Earn Quiz App – Quiz Dangal"
        description="Invite friends, they play quizzes, and you both earn. Learn how the referral code works, bonus rules, and best practices to invite more effectively."
        canonical={canonical}
        alternateLocales={['hi_IN','en_US']}
        keywords={["refer and earn quiz", "invite friends earn coins", "quiz app referral india", "quizdangal refer"]}
        jsonLd={[faqSchema]}
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">Refer & Earn – Quiz Dangal</h1>
        <p className="text-slate-300 max-w-3xl">Refer & Earn lets you invite friends to Quiz Dangal using a unique code or link. When they sign up and start playing, both of you get bonus coins. It’s simple, transparent, and designed to reward genuine participation, not spam. Below we’ll explain how to find your code, how bonuses are applied, and tips to invite effectively.</p>

        <h2 className="text-2xl font-semibold text-white">How It Works</h2>
        <p className="text-slate-300 max-w-3xl">After you log in, go to your profile or wallet section to view your referral code. Share your code or invite link with friends. Once they create an account and complete their first few games, the bonus coins are assigned automatically to both accounts. You’ll see the progress in-app, and can always check your total earned from referrals.</p>

        <h2 className="text-2xl font-semibold text-white">Bonus Rules</h2>
        <ul className="list-disc pl-6 text-slate-300 space-y-2 max-w-3xl">
          <li>Bonuses are awarded when the referred friend finishes eligible rounds (to prevent abuse).</li>
          <li>Each player can use only one referral code during sign-up.</li>
          <li>We monitor fraud patterns to keep the system fair for everyone.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-white">Inviting Tips</h2>
        <ul className="list-disc pl-6 text-slate-300 space-y-2 max-w-3xl">
          <li>Send your link with a short message: what Quiz Dangal is and why it’s fun.</li>
          <li>Ask friends to try <a href="/opinion-quiz-app/" className="text-indigo-300 underline">Opinion Quizzes</a> first—they’re quick and easy to start.</li>
          <li>Share leaderboard screenshots to create friendly competition. Check the <a href="/leaderboards/" className="text-indigo-300 underline">Leaderboards</a> anytime.</li>
        </ul>

  <p className="text-slate-300 max-w-3xl">If you’re new, learn our scoring and strategy basics on <a href="/play-win-quiz-app/" className="text-indigo-300 underline">Play & Win</a>. Then invite your group and climb the ranks together.</p>

        <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Why Refer?</h3>
          <ul className="list-disc pl-6 text-slate-300 space-y-1">
            <li>Both players benefit—bonuses on real activity.</li>
            <li>Build your squad and keep the game social.</li>
            <li>Track invites and bonuses inside the app.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
