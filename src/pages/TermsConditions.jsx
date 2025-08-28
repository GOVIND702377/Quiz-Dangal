import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Shield, Users, CreditCard, AlertTriangle, CheckCircle, FileText, Calendar, Gavel, EyeOff, Copyright, Info, MessageSquare, Repeat } from 'lucide-react';

const TermsConditions = () => {
  const sections = [
    {
      icon: Users,
      title: '1. Eligibility',
      content: [
        'Users must be 13 years or older to create an account.',
        'By using this App, you confirm that all details provided (name, username, email) are accurate.',
        'One person = one account. Multiple or fake accounts are prohibited.'
      ]
    },
    {
      icon: Shield,
      title: '2. Registration & Accounts',
      content: [
        'To use Quiz Dangal, you must register with a unique username, display name, and email.',
        'You are responsible for maintaining the confidentiality of your account credentials.',
        'You agree not to share your account or impersonate another person.',
        'Quiz Dangal is not liable for losses caused by misuse of your login details.'
      ]
    },
    {
      icon: FileText,
      title: '3. Gameplay Rules',
      content: [
        'Skill-Based Quizzes – Winners are decided based on performance, knowledge, accuracy, and speed.',
        'Quiz Timings – Each quiz has a fixed start and end time. Submissions after time expiry will not be valid.',
        'Results – Once results are declared, they are final and cannot be challenged.',
        'Fairness – All quizzes are designed to provide equal opportunities to all participants.'
      ]
    },
    {
      icon: CreditCard,
      title: '4. Rewards & Wallet',
      content: [
        'All quizzes are free to enter.',
        'Based on performance, users earn coins/rewards which are stored in their in-app wallet.',
        'Rewards are for entertainment and recognition. In the future, withdrawal features may be introduced, which may require identity verification (KYC).',
        'Rewards cannot be transferred or exchanged outside the app unless officially announced.'
      ]
    },
    {
      icon: Users,
      title: '5. Referral & Earn Program',
      content: [
        'Users may invite friends using their unique referral codes.',
        'Coins are credited once the referred user successfully registers and engages.',
        'Any misuse of referral (e.g., self-referrals, fake accounts) may lead to account suspension.'
      ]
    },
    {
      icon: AlertTriangle,
      title: '6. Responsible Usage',
      content: [
        'Quiz Dangal is a platform for fun, learning, and skill development.',
        'It is not gambling and does not involve betting or wagering real money.',
        'We encourage users to play responsibly and in moderation.'
      ]
    },
    {
      icon: EyeOff,
      title: '7. Fair Play & Security',
      content: [
        'Users must not: create multiple or fake accounts; use bots, scripts, or cheats; manipulate results in any way.',
        'Violation may result in: immediate account suspension, loss of rewards, and permanent ban from the platform.'
      ]
    },
    {
      icon: Copyright,
      title: '8. Intellectual Property',
      content: [
        'All app content (questions, designs, logos, data, software) belongs to Quiz Dangal.',
        'Users cannot copy, resell, or exploit app content without permission.'
      ]
    },
    {
      icon: Info,
      title: '9. Limitation of Liability',
      content: [
        'The platform is provided “as is” and “as available.”',
        'Quiz Dangal makes no guarantees of uninterrupted or error-free service.',
        'We are not liable for indirect or incidental losses caused by using the platform.'
      ]
    },
    {
      icon: Repeat,
      title: '10. Changes & Updates',
      content: [
        'Quiz Dangal may update features, rewards, or terms at any time.',
        'Major changes will be notified in-app.',
        'Continued use of the app after updates = acceptance of new terms.'
      ]
    },
    {
      icon: MessageSquare,
      title: '11. Contact Us',
      content: [
  'For questions, support, or feedback: support@quizdangal.com'
      ]
    }
  ];

  const highlights = [
    {
      icon: CheckCircle,
      title: 'Skill-Based Gaming',
      description: 'Winners determined by skill, knowledge, and prediction abilities'
    },
    {
      icon: Shield,
      title: 'Secure Transactions',
      description: 'KYC compliance and secure payment gateways for all transactions'
    },
    {
      icon: Gavel,
      title: 'Legal Compliance',
      description: 'Full adherence to Indian laws and gaming regulations'
    },
    {
      icon: AlertTriangle,
      title: 'Responsible Gaming',
      description: 'Tools and resources to promote healthy gaming habits'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-black">
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
        <h1 className="text-3xl font-bold gradient-text mb-4">Terms & Conditions</h1>
        <div className="flex items-center justify-center space-x-2 text-gray-600 mb-4">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Last Updated: August 27, 2025</span>
        </div>
        <p className="text-lg text-gray-800 leading-relaxed">
          These Terms & Conditions (“Terms”) govern your use of the Quiz Dangal mobile application (“App” or “Platform”). By using Quiz Dangal, you agree to these Terms. Please read them carefully.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-yellow-600">Important Notice</h2>
        </div>
        <p className="text-gray-800 leading-relaxed">
          If you do not agree to these Terms, you must not use the Platform. By continuing to use Quiz Dangal, you acknowledge that you have read, understood, and agree to be bound by these terms and conditions.
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
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 text-center"
          >
            <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <highlight.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{highlight.title}</h3>
            <p className="text-xs text-gray-700 leading-relaxed">{highlight.description}</p>
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
            className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6"
          >
            <div className="flex items-start space-x-4 mb-4">
              <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-3 rounded-full flex-shrink-0">
                <section.icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold gradient-text">{section.title}</h2>
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
                  <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-sm leading-relaxed">{item}</p>
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
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-6 h-6 text-green-500" />
          <h2 className="text-xl font-bold text-green-600">Legal Compliance</h2>
        </div>
        <div className="space-y-3 text-gray-800">
          <p className="text-sm leading-relaxed">
            Quiz Dangal operates in full compliance with Indian laws and regulations governing online gaming and skill-based competitions.
          </p>
          <p className="text-sm leading-relaxed">
            We are committed to maintaining the highest standards of legal and ethical conduct in all our operations.
          </p>
          <p className="text-sm leading-relaxed">
            For any legal queries or concerns, please contact us through our official support channels.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.7 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center"
      >
        <FileText className="w-12 h-12 text-pink-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold gradient-text mb-3">Questions About These Terms?</h3>
        <p className="text-gray-800 leading-relaxed mb-4">
          If you have any questions about these Terms & Conditions, please don't hesitate to contact our support team.
        </p>
        <p className="text-gray-600 text-sm">
          We're here to help ensure you have a clear understanding of our platform policies and your rights as a user.
        </p>
      </motion.div>
    </div>
  );
};

export default TermsConditions;