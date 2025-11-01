import React from 'react';
import SEO from '@/components/SEO';
import {
  FileText,
  Calendar,
  Shield,
  Users,
  Info,
  Database,
  EyeOff,
  Repeat,
  CheckCircle,
} from 'lucide-react';
import { getBrandGradient } from '@/lib/brand';

const sections = [
  {
    icon: Users,
    title: '1. Information We Collect',
    content: [
      'We collect account details you provide (e.g., name, email, username, mobile number), basic device/usage info for app functionality, and quiz performance data.',
    ],
  },
  {
    icon: Info,
    title: '2. How We Use Your Information',
    content: [
      'To run your account, enable quizzes and rewards, improve the app, ensure fair play, send updates, and meet legal duties (if applicable).',
    ],
  },
  {
    icon: Shield,
    title: '3. Sharing of Information',
    content: [
      'We do not sell your data. We may share with service providers, legal authorities when required, and for fraud prevention.',
    ],
  },
  {
    icon: Database,
    title: '4. Data Storage & Security',
    content: [
      'Data is stored on secure services (e.g., Supabase/PostgreSQL) with encryption and access controls. No system is 100% secure—use strong passwords.',
    ],
  },
  {
    icon: CheckCircle,
    title: '5. Your Rights',
    content: [
      'You may request access, correction, deletion (subject to law), and opt out of non-essential notifications.',
    ],
  },
  {
    icon: EyeOff,
    title: "6. Children's Privacy",
    content: [
      'For users 18+. We do not knowingly collect data from individuals under 18 years of age.',
    ],
  },
  {
    icon: Repeat,
    title: '7. Cookies & Tracking',
    content: [
      'We use cookies/tech to save preferences and analyze usage. Disabling them may affect functionality.',
    ],
  },
  {
    icon: Repeat,
    title: '8. Changes to Privacy Policy',
    content: [
      'We may update this policy and will post changes in the app.',
    ],
  },
  {
    icon: Database,
    title: '9. Data Retention',
    content: [
      'Account data is retained as long as your account is active. Inactive accounts (no login for 2+ years) may be archived. You can request account deletion anytime via support@quizdangal.com. Deletion is processed within 30 days, subject to legal obligations.',
    ],
  },
  {
    icon: Info,
    title: '10. Third-Party Services',
    content: [
      'We use Supabase (database & authentication), Google Analytics (usage tracking), and Web Push (notifications). These services have their own privacy policies. We do not share personal data beyond what is necessary for app functionality.',
    ],
  },
  {
    icon: Shield,
    title: '11. Advertising',
    content: [
      'We may display third-party advertisements (Google AdSense). Advertisers may use cookies to serve relevant ads. You can opt-out via Google Ad Settings. We do not control advertiser content.',
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen pt-14 text-slate-100">
      <div className="container mx-auto px-4 py-6 space-y-8">
        <SEO
          title="Privacy Policy – Quiz Dangal"
          description="How Quiz Dangal collects, uses, stores, and protects your personal data and quiz activity."
          canonical="https://quizdangal.com/privacy-policy/"
          alternateLocales={['hi_IN','en_US']}
          keywords={[
            'quiz dangal privacy',
            'quiz app privacy policy',
            'quiz dangal data protection',
          ]}
        />

        <section className="text-center mb-8 animate-fade-up" style={{ '--fade-delay': '40ms' }}>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-2">
            Privacy Policy
          </h1>
          <div className="flex items-center justify-center space-x-2 text-slate-300 mb-3">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Last Updated: November 1, 2025</span>
          </div>
          <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto">
            At Quiz Dangal, we value your privacy and are committed to protecting your personal data. By using the app, you agree to this Privacy Policy.
          </p>
        </section>
        <div className="space-y-6">
          {sections.map((section, index) => {
            const baseDelay = 240 + index * 90;
            return (
              <section
                key={section.title}
                className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-6 animate-fade-up"
                style={{ '--fade-delay': `${baseDelay}ms` }}
              >
                <div className="flex items-start space-x-4 mb-4">
                  <div className={`bg-gradient-to-r ${getBrandGradient(index)} p-3 rounded-full flex-shrink-0`}>
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-3 ml-0 md:ml-16">
                  {section.content.map((item, itemIndex) => (
                    <div
                      key={`${section.title}-${itemIndex}`}
                      className="flex items-start space-x-3 animate-fade-left"
                      style={{ '--fade-left-delay': `${baseDelay + 50 + itemIndex * 40}ms` }}
                    >
                      <div className="w-2 h-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-slate-300 text-sm leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section
          className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 text-center animate-fade-up"
          style={{ '--fade-delay': '520ms' }}
        >
          <FileText className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent mb-3">
            Questions About This Policy?
          </h3>
          <p className="text-slate-300 leading-relaxed mb-2">We’re here to help.</p>
          <p className="text-slate-400 text-sm">Contact: support@quizdangal.com</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
