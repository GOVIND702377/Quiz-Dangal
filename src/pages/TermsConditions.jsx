import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Shield, Users, CreditCard, AlertTriangle, CheckCircle, FileText, Calendar, EyeOff, Copyright, Info, Repeat } from 'lucide-react';
import { getBrandGradient, getBrandText } from '@/lib/brand';

const TermsConditions = () => {
  const sections = [
    {
      icon: Users,
      title: '1. Eligibility',
      content: [
        'Users must be 13+ and provide accurate details.',
        'One user, one account. No fake or duplicate accounts.'
      ]
    },
    {
      icon: Shield,
      title: '2. Registration & Accounts',
      content: [
        'Register with a unique username and email. Keep your login secure and do not share it.'
      ]
    },
    {
      icon: FileText,
      title: '3. Gameplay Rules',
      content: [
        'Skill-based quizzes—winners decided by performance, accuracy, and speed.',
        'Each quiz has fixed start and end time; late submissions are invalid.',
        'Once results are declared, they are final.'
      ]
    },
    {
      icon: CreditCard,
      title: '4. Rewards & Wallet',
      content: [
        'All quizzes are free to enter. Earn coins/rewards in your in-app wallet based on performance.',
        'Withdrawals (if introduced later) may require KYC as per law.'
      ]
    },
    {
      icon: Users,
      title: '5. Referral & Earn Program',
      content: [
        'Invite friends via referral. Misuse (self-referrals/fake accounts) may lead to suspension.'
      ]
    },
    {
      icon: AlertTriangle,
      title: '6. Responsible Usage',
      content: [
        'For fun and learning—this is not gambling. Play responsibly.'
      ]
    },
    {
      icon: EyeOff,
      title: '7. Fair Play & Security',
      content: [
        'No bots, scripts, cheats, or result manipulation. Violations may lead to suspension or ban.'
      ]
    },
    {
      icon: Copyright,
      title: '8. Intellectual Property',
      content: [
        'All content belongs to Quiz Dangal. Do not copy or resell without permission.'
      ]
    },
    {
      icon: Info,
      title: '9. Limitation of Liability',
      content: [
        'Service is provided “as is” and “as available.” We do not guarantee uninterrupted or error-free access.'
      ]
    },
    {
      icon: Repeat,
      title: '10. Changes & Updates',
      content: [
        'We may update features, rewards, or terms. Continued use means acceptance.'
      ]
    }
  ];

  // Highlights (4 boxes)
  const highlights = [
    { icon: CheckCircle, title: 'Skill-Based', description: 'Win by knowledge and speed' },
    { icon: Shield, title: 'Secure', description: 'Protected data and fair play' },
    { icon: AlertTriangle, title: 'Responsible', description: 'Play healthy and safe' },
    { icon: Repeat, title: 'Daily Quizzes', description: 'Fresh challenges every day' }
  ];

  return (
  <div className="min-h-screen text-slate-100">
      <div className="container mx-auto px-4 py-6 space-y-8">
      <Helmet>
  <title>Terms & Conditions – Quiz Dangal</title>
  <meta name="description" content="Terms & Conditions for using Quiz Dangal – eligibility, accounts, gameplay, rewards, fair play, and contact details." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-4">Terms & Conditions</h1>
        <div className="flex items-center justify-center space-x-2 text-slate-300 mb-4">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Last Updated: August 27, 2025</span>
        </div>
        <p className="text-lg text-slate-300 leading-relaxed">
          By using Quiz Dangal, you agree to these Terms. Please read them.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-amber-300">Important Notice</h2>
        </div>
        <p className="text-slate-300 leading-relaxed">
          If you do not agree, please do not use the platform.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
  {highlights.map((highlight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
      className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-4 text-center"
          >
            <div className={`bg-gradient-to-r ${getBrandGradient(index)} p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center`}>
              <highlight.icon className="w-6 h-6 text-white" />
            </div>
      <h3 className="text-sm font-semibold text-white mb-2">{highlight.title}</h3>
      <p className="text-xs text-slate-300 leading-relaxed">{highlight.description}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
            className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-6"
          >
            <div className="flex items-start space-x-4 mb-4">
              <div className={`bg-gradient-to-r ${getBrandGradient(index)} p-3 rounded-full flex-shrink-0`}>
                <section.icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">{section.title}</h2>
            </div>
            
            <div className="space-y-4 ml-0 md:ml-16">
              {section.content.map((item, itemIndex) => (
                <motion.div
                  key={itemIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 + index * 0.1 + itemIndex * 0.05 }}
                  className="flex items-start space-x-3"
                >
                  <div className={`w-2 h-2 bg-gradient-to-r ${getBrandGradient(itemIndex)} rounded-full mt-2 flex-shrink-0`}></div>
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
        transition={{ duration: 0.5, delay: 1.6 }}
        className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-bold text-emerald-300">Legal Compliance</h2>
        </div>
        <div className="space-y-3 text-slate-300">
          <p className="text-sm leading-relaxed">
            Quiz Dangal operates in compliance with applicable Indian laws for online skill-based competitions.
          </p>
          <p className="text-sm leading-relaxed">
            For any legal queries, contact us at support@quizdangal.com.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.7 }}
        className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 text-center"
      >
        <FileText className="w-12 h-12 text-fuchsia-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold bg-gradient-to-r from-violet-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent mb-3">Questions About These Terms?</h3>
        <p className="text-slate-300 leading-relaxed mb-4">
          If you have any questions about these Terms & Conditions, please don't hesitate to contact our support team.
        </p>
        <p className="text-slate-400 text-sm">
          We're here to help ensure you have a clear understanding of our platform policies and your rights as a user.
        </p>
      </motion.div>
      </div>
    </div>
  );
};

export default TermsConditions;