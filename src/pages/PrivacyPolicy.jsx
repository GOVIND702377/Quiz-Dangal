import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { FileText, Calendar, Shield, Users, Info, Mail, Database, EyeOff, CheckCircle, Repeat } from 'lucide-react';
import { getBrandGradient } from '@/lib/brand';

const PrivacyPolicy = () => {
  const sections = [
    {
      icon: Users,
      title: '1. Information We Collect',
      content: [
        'We may collect the following information when you use Quiz Dangal:',
        '• Information You Provide Directly: Username, display name, email address, avatar, profile updates, and referral information.',
        '• Information Collected Automatically: Device model, OS, app version, unique identifiers, usage data (quizzes joined, scores, coins, referrals), IP address, time zone, and interaction logs.',
        '• Optional Information: KYC documents (e.g., PAN, Aadhaar) only if/when withdrawals are introduced, as required by Indian law.'
      ]
    },
    {
      icon: Info,
      title: '2. How We Use Your Information',
      content: [
        'Create and manage your account; enable quiz participation and results display;',
        'Provide rewards, coins, and referral benefits;',
        'Improve performance, features, and user experience;',
        'Ensure fair play and detect fraud or misuse;',
        'Send updates, notifications, and important announcements;',
        'Comply with legal obligations (KYC/tax if withdrawals are enabled).'
      ]
    },
    {
      icon: Shield,
      title: '3. Sharing of Information',
      content: [
        'We do not sell or rent personal data. We may share information with:',
        '• Service Providers: Trusted vendors for analytics, hosting, or payments;',
        '• Legal Authorities: When required by law or court order;',
        '• Fraud Prevention: To investigate or prevent cheating, fraud, or misuse.'
      ]
    },
    {
      icon: Database,
      title: '4. Data Storage & Security',
      content: [
        'Data is stored securely on Supabase/PostgreSQL and related services.',
        'We use encryption, access controls, and monitoring to protect information.',
        'No system is 100% secure; users should maintain strong password practices.'
      ]
    },
    {
      icon: CheckCircle,
      title: '5. Your Rights',
      content: [
        'Access: Request details of data we hold about you;',
        'Correction: Update or correct account information;',
        'Deletion: Request deletion of account/data (subject to legal obligations);',
        'Opt-Out: Disable notifications or withdraw consent for non-essential usage.'
      ]
    },
    {
      icon: EyeOff,
      title: "6. Children's Privacy",
      content: [
        'Intended for users 13+; we do not knowingly collect data from children under 13. Such accounts will be deleted if discovered.'
      ]
    },
    {
      icon: Repeat,
      title: '7. Cookies & Tracking',
      content: [
        'We may use cookies or similar technologies to save preferences, track in-app activity, and analyze usage. Disabling cookies may affect functionality.'
      ]
    },
    {
      icon: Repeat,
      title: '8. Changes to Privacy Policy',
      content: [
        'We may update this Privacy Policy from time to time. Updates are effective upon posting in the app. Significant changes will be notified in-app.'
      ]
    },
    {
      icon: Mail,
      title: '9. Contact Us',
      content: [
  'For queries or concerns: support@quizdangal.com'
      ]
    },
  ];

  return (
  <div className="min-h-screen text-slate-100">
      <div className="container mx-auto px-4 py-6 space-y-8">
      <Helmet>
        <title>Privacy Policy – Quiz Dangal</title>
        <meta name="description" content="How Quiz Dangal collects, uses, and protects your personal data." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-2">Privacy Policy</h1>
        <div className="flex items-center justify-center space-x-2 text-slate-300 mb-3">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Effective Date: August 27, 2025</span>
        </div>
        <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto">
          At Quiz Dangal, we value your privacy and are committed to protecting your personal data. By using the app, you agree to this Privacy Policy.
        </p>
      </motion.div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.05 }}
            className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-6"
          >
            <div className="flex items-start space-x-4 mb-4">
              <div className={`bg-gradient-to-r ${getBrandGradient(index)} p-3 rounded-full flex-shrink-0`}>
                <section.icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">{section.title}</h2>
            </div>
            <div className="space-y-3 ml-0 md:ml-16">
              {section.content.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                  className="flex items-start space-x-3"
                >
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm leading-relaxed">{item}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 text-center"
      >
        <FileText className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent mb-3">Questions About This Policy?</h3>
        <p className="text-slate-300 leading-relaxed mb-2">We’re here to help.</p>
  <p className="text-slate-400 text-sm">Contact: support@quizdangal.com</p>
      </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
