import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Scale, Shield, FileText, Calendar, AlertTriangle, CheckCircle, Gavel, CreditCard, Users } from 'lucide-react';

const Legality = () => {
  const sections = [
    {
      icon: Scale,
      title: '1. Legality of Skill-Based Games in India',
      content: [
        'The legal foundation for skill-based gaming in India is primarily established through judicial pronouncements and exceptions within state laws, rather than a single central act specifically legalizing it.',
        'The Public Gambling Act, 1867, a central legislation, generally prohibits gambling across most of India. However, Section 12 of this Act specifically exempts "games of mere skill" from its prohibitions.',
        'The Supreme Court of India and various High Courts have, through landmark judgments, consistently differentiated between "games of skill" and "games of chance." They have repeatedly affirmed that competitions where success depends on a "substantial degree of skill" are not considered gambling.',
        'Key judgments, such as those in State of Bombay v. R.M.D. Chamarbaugwala (1957) and K.R. Lakshmanan v. State of Tamil Nadu (1996), have reinforced that "games of mere skill" essentially mean games predominantly reliant on skill, even if a minor element of chance exists.',
        'For Quiz Dangal, our format, where the most-voted option wins, requires users to apply analytical abilities and foresight to predict collective thought. This constitutes a significant element of skill, setting it apart from games purely based on luck.'
      ]
    },
    {
      icon: AlertTriangle,
      title: '2. State-Specific Laws & Restrictions',
      content: [
        'Laws regarding online gaming in India vary significantly from state to state, as "betting and gambling" is a state subject.',
        'Quiz Dangal is designed to operate in all Indian states where skill-based online gaming is legally permissible.',
        'However, it\'s crucial to note that certain states, including Telangana, Andhra Pradesh, Assam, Odisha, and Tamil Nadu, have enacted specific laws prohibiting online gaming for real money. Residents from these states are not permitted to play on the Platform for real cash prizes.',
        'It is your (the user\'s) sole responsibility to understand and comply with your local laws. If you access the Platform from a jurisdiction where real money gaming is prohibited, your participation is illegal, and Quiz Dangal shall not be held liable.'
      ]
    },
    {
      icon: CreditCard,
      title: '3. Taxation & Compliance',
      content: [
        'Quiz Dangal is committed to adhering to all applicable Indian tax laws and regulatory guidelines, particularly concerning financial transactions.',
        'TDS (Tax Deducted at Source): As per Indian income tax laws, a TDS of 30% will be deducted on all net winnings from online gaming, regardless of the winning amount (there is no minimum threshold for this deduction since April 1, 2023). This deduction will occur either at the time of withdrawal or at the end of the financial year (whichever is earlier). Quiz Dangal will deduct and remit the TDS to the government and provide you with a TDS Certificate (Form 16A).',
        'GST (Goods and Services Tax): Online money gaming is subject to 28% GST as per current Indian GST laws, applicable on the full face value of the bet (i.e., the total amount deposited by the user to participate).',
        'KYC (Know Your Customer): To comply with the Prevention of Money Laundering Act (PMLA) guidelines and ensure user identity, KYC verification is mandatory for all users, especially when they withdraw a cumulative amount of ₹10,000 or more in a financial year. Your KYC information will be kept confidential and secure.'
      ]
    },
    {
      icon: Users,
      title: '4. Responsible Gaming',
      content: [
        'We strongly advocate for responsible gaming practices. Online gaming can involve financial risk and may be addictive.',
        'We advise users to play responsibly, set their limits, and only spend what they can afford to lose.',
        'If you feel you may have a gaming-related problem, please seek professional help.'
      ]
    },
    {
      icon: Shield,
      title: '5. Disclaimer',
      content: [
        'While we make every effort to ensure compliance with all applicable laws, Quiz Dangal will not be held responsible for any legal issues or consequences arising from your failure to comply with these terms or your local laws.',
        'It is advisable to seek independent legal counsel in case of any ambiguity.',
        'By using Quiz Dangal, you acknowledge that you have read and understood these legal terms and agree to be bound by them. Play responsibly and within legal boundaries!'
      ]
    }
  ];

  const highlights = [
    {
      icon: CheckCircle,
      title: 'Skill-Based Platform',
      description: 'Quiz Dangal is a skill-based opinion-based gaming platform'
    },
    {
      icon: Gavel,
      title: 'Legal Foundation',
      description: 'Based on Supreme Court judgments and Section 12 of Public Gambling Act, 1867'
    },
    {
      icon: Shield,
      title: 'Full Compliance',
      description: 'Adheres to all applicable Indian tax laws and regulatory guidelines'
    },
    {
      icon: AlertTriangle,
      title: 'State Restrictions',
      description: 'Not available in states where online gaming is prohibited'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-black">
      <Helmet>
        <title>Legal Information - Quiz Dangal</title>
        <meta name="description" content="Learn about the legal framework and compliance of Quiz Dangal's skill-based gaming platform." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold gradient-text mb-4">Legal Information</h1>
        <div className="flex items-center justify-center space-x-2 text-gray-600 mb-4">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Last Updated: June 27, 2025</span>
        </div>
        <p className="text-lg text-gray-800 leading-relaxed max-w-3xl mx-auto">
          Quiz Dangal is a skill-based opinion-based gaming platform. We strongly emphasize that our gameplay is solely based on the player's knowledge, insight, analytical ability, and predictive skills, and not merely on chance or gambling.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <Scale className="w-6 h-6 text-green-500" />
          <h2 className="text-xl font-bold text-green-600">Legal Framework</h2>
        </div>
        <p className="text-gray-800 leading-relaxed">
          Under Indian law, games of skill are considered legal, while games of chance are prohibited in most states. Quiz Dangal operates strictly within the legal framework of skill-based gaming.
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
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center"
      >
        <FileText className="w-12 h-12 text-pink-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold gradient-text mb-3">Legal Compliance Commitment</h3>
        <p className="text-gray-800 leading-relaxed max-w-2xl mx-auto">
          Quiz Dangal is committed to operating within the legal framework of India and ensuring full compliance with all applicable laws and regulations. We prioritize transparency and responsible gaming practices.
        </p>
      </motion.div>
    </div>
  );
};

export default Legality;