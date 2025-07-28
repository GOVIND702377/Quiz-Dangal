import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Shield, Users, CreditCard, AlertTriangle, CheckCircle, FileText, Calendar, Gavel, EyeOff, Copyright, Info, MessageSquare, Repeat } from 'lucide-react';

const TermsConditions = () => {
  const sections = [
    {
      icon: Users,
      title: '1. User Eligibility',
      content: [
        'You may use this Platform only if you are 18 years of age or older and are competent to contract under the Indian Contract Act, 1872.',
        'You acknowledge that real money gaming on the Platform is legal only in Indian states where it is not prohibited. If you are accessing the Platform from a state (such as Telangana, Andhra Pradesh, Assam, Odisha, and Tamil Nadu) where online gaming is prohibited, your participation is illegal, and Quiz Dangal shall be absolved of any liability.',
        'You represent and warrant that all information you provide to us is true, accurate, and complete.'
      ]
    },
    {
      icon: Shield,
      title: '2. Registration & Account Security',
      content: [
        'To use the Platform, you must register an account. You will need to create a username and password during the registration process.',
        'You are solely responsible for maintaining the confidentiality of your account details and for all activities that occur under your account.',
        'You agree to notify us immediately of any unauthorized use of your account or any breach of security. Quiz Dangal will not be liable for any loss that you may incur as a result of unauthorized use of your password.',
        'You may not create more than one account or use the account of any other person.'
      ]
    },
    {
      icon: FileText,
      title: '3. Gameplay Rules',
      content: [
        'Game Type: Quiz Dangal is a skill-based opinion-based quiz game. The winner is determined primarily based on the user\'s skill, knowledge, analysis, and prediction abilities, not solely on chance.',
        'Winner Determination: In each quiz, the option that receives the highest number of valid votes within the stipulated time limit shall be considered the \'correct\' or \'winning\' option. Winners will be those users who selected that \'winning\' option.',
        'Quiz Timer: Each quiz will commence at a fixed time and remain open for a specified duration. Users must submit their answers within this timeframe. Answers submitted after the timer expires will not be valid.',
        'Entry Fees: Participation in a quiz will require the payment of a specified entry fee.',
        'Prize Distribution: After the quiz results are declared, winning users will have their prize money automatically credited to their Quiz Dangal wallet. The method and amount of prize distribution may vary from quiz to quiz and will be clearly stated before the quiz begins.'
      ]
    },
    {
      icon: CreditCard,
      title: '4. Payments & Withdrawals',
      content: [
        'Wallet Management: Your Quiz Dangal account will feature an in-app wallet where your deposited funds and winnings will be stored.',
        'Payments: You can add funds to your wallet using various secure payment methods available on the Platform (e.g., UPI, NetBanking, Credit/Debit cards, etc.).',
        'Withdrawals: You may request to withdraw funds from your wallet to your registered bank account/UPI ID.',
        'KYC Requirement: To comply with Indian laws and guidelines, you will be required to complete a \'Know Your Customer\' (KYC) verification process for withdrawals exceeding a specified limit (currently total withdrawals of ₹10,000 or more in a financial year). This will involve submitting your identity and address proof documents. Withdrawal requests will not be processed until the KYC process is completed.',
        'TDS Deduction: As per Indian income tax laws, a TDS (Tax Deducted at Source) of 30% will be levied on all net winnings from online gaming, regardless of the winning amount (no minimum threshold). This deduction will occur either at the time of withdrawal or at the end of the financial year, whichever is earlier. You will see the TDS credit in your Form 26AS, and Quiz Dangal will issue you a TDS Certificate (Form 16A).',
        'Withdrawal requests may take 24-72 business hours to process, though we strive for faster payouts.'
      ]
    },
    {
      icon: AlertTriangle,
      title: '5. Responsible Gaming Policies',
      content: [
        'Quiz Dangal is committed to promoting a responsible gaming environment. We provide tools and resources to help users manage their gaming habits.',
        'You may set limits on your gaming activity, including deposit limits, spending limits, and self-exclusion options.',
        'We advise you to play responsibly and only spend what you can afford to lose. If you feel you may have a gaming problem, please seek professional help.'
      ]
    },
    {
      icon: EyeOff,
      title: '6. Unfair Play & Fraud',
      content: [
        'Any form of fraud, manipulation, or unfair play is strictly prohibited on Quiz Dangal. This includes, but is not limited to: creating multiple accounts, using bots, interfering with quizzes, or engaging in any illegal activities.',
        'If we suspect that you have engaged in unfair play or violated these Terms, we reserve the right to suspend or terminate your account, confiscate your winnings, and bar you from future use of the Platform.',
        'Any fraudulent or suspicious activity may be reported to the relevant authorities.'
      ]
    },
    {
      icon: Copyright,
      title: '7. Intellectual Property Rights',
      content: [
        'The Platform and all content contained therein (including, but not limited to, text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software) are the property of Quiz Dangal or its content suppliers and protected by Indian and international copyright laws.',
        'You may not reproduce, duplicate, copy, sell, resell, or exploit any portion of the content on the Platform without the express written consent of Quiz Dangal.'
      ]
    },
    {
      icon: Info,
      title: '8. Limitation of Liability',
      content: [
        'Quiz Dangal provides the Platform on an "as is" and "as available" basis. We make no warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.',
        'To the fullest extent permissible by law, Quiz Dangal will not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including damages for loss of profits, goodwill, use, data, or other intangible losses, resulting from the use or inability to use the Platform.'
      ]
    },
    {
      icon: MessageSquare,
      title: '9. Dispute Resolution',
      content: [
        'Any dispute or claim relating in any way to these Terms will be resolved through amicable settlement via mediation first.',
        'If the dispute is not resolved through mediation, such disputes shall be subject to the exclusive jurisdiction of the courts located in New Delhi, India.',
        'These Terms shall be governed by and construed in accordance with the laws of India.'
      ]
    },
    {
      icon: Repeat,
      title: '10. Changes to Terms',
      content: [
        'Quiz Dangal reserves the right to modify, update, or change these Terms and Conditions at any time.',
        'Any changes made to these Terms will be effective immediately upon posting on the Platform. It is your responsibility to review these Terms regularly.',
        'Your continued use of the Platform after the posting of modifications will constitute your acceptance of the revised Terms.'
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
        <title>Terms & Conditions - Quiz Dangal</title>
        <meta name="description" content="Read Quiz Dangal's Terms & Conditions for platform usage, gameplay rules, and legal compliance." />
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
          <span className="text-sm">Last Updated: June 27, 2025</span>
        </div>
        <p className="text-lg text-gray-800 leading-relaxed">
          Please read these Terms & Conditions carefully before using the Quiz Dangal platform. By using this Platform, you agree to be bound by these Terms.
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