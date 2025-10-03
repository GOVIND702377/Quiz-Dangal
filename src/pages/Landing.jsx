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
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }} />

      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-4xl w-full text-center text-slate-100">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-pink-200 bg-clip-text text-transparent">
            India Quiz: Play & Win on Quiz Dangal
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            Opinion, GK, Sports, Movies – har roz naye quizzes. Khelo, sikho, aur rewards jeeto. Refer & Earn se extra coins pao!
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/#/login" className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow">
              Start Playing
            </a>
            <a href="/#/leaderboards" className="px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700">
              View Leaderboards
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            {[{
              t: 'Play & Win',
              d: 'Daily contests with fair rules and transparent scoring.'
            },{
              t: 'Refer & Earn',
              d: 'Invite friends using your link and get bonus coins.'
            },{
              t: 'Made for India',
              d: 'Short quizzes in popular categories—perfect for quick fun.'
            }].map((b,i)=> (
              <div key={i} className="rounded-2xl bg-slate-900/60 border border-slate-700/60 p-5 text-left">
                <div className="text-xl font-bold text-white">{b.t}</div>
                <div className="mt-1 text-slate-300">{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
