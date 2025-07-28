import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Target, Users, Trophy, Shield, CheckCircle, Star } from 'lucide-react';

const AboutUs = () => {
  const features = [
    {
      icon: Target,
      title: 'Thrilling Quizzes',
      description: 'Discover new, engaging, and thought-provoking questions daily that will make you ponder and give you a voice.'
    },
    {
      icon: Users,
      title: 'Dynamic Gameplay',
      description: 'The "most-voted option wins" rule makes every quiz unpredictable and exciting. It\'s not just about knowing the right answer, but about anticipating the collective mindset.'
    },
    {
      icon: Trophy,
      title: 'Real-time Leaderboards',
      description: 'As soon as a quiz concludes, check your rank and winnings on our real-time leaderboards. See how you performed against others and if you\'ve secured a cash prize.'
    },
    {
      icon: Shield,
      title: 'Secure & Transparent',
      description: 'We prioritize your financial security. With secure payment gateways, in-app wallet management, and instant withdrawal options, your winnings are directly transferred to your bank account.'
    }
  ];

  const principles = [
    'Responsible Gaming: We champion responsible gaming with tools and resources to help you manage your gaming activity.',
    'KYC Compliance: Adhering to Indian laws and guidelines, we implement a robust KYC verification system for withdrawals.',
    'Skill-based Gaming: Your analytical abilities and forecasting prowess are the keys to your success.',
    'Community Focus: Connect with others\' perspectives and see what the majority thinks.'
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <Helmet>
        <title>About Us - Quiz Dangal</title>
        <meta name="description" content="Learn about Quiz Dangal - the platform where your opinion isn't just a thought, but a winning stake!" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold gradient-text mb-4">About Quiz Dangal</h1>
        <p className="text-lg text-gray-800 leading-relaxed">
          Welcome to Quiz Dangal – the platform where your opinion isn't just a thought, but a winning stake!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Our Mission</h2>
        <p className="text-gray-800 leading-relaxed">
          We believe that everyone's opinion matters, and when those opinions are brought together, they tell a powerful story. Quiz Dangal was founded on this very idea: to create a dynamic and secure platform where you can not only showcase your insights but also connect with others' perspectives and see what the majority thinks.
        </p>
        <p className="text-gray-800 leading-relaxed">
          We are committed to providing a unique, transparent, and responsible experience of entertainment, learning, and real rewards.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">What We Do</h2>
        <p className="text-gray-800 leading-relaxed">
          Quiz Dangal is an exciting and innovative opinion-based quiz app. Here, instead of traditional 'right or wrong' answers, questions challenge your intuition and predictive skills. We invite you to express your views on current events, social trends, popular culture, or even speculative scenarios.
        </p>
        <p className="text-gray-800 leading-relaxed">
          Our unique gameplay rule ensures that the option that receives the most votes is considered the 'winner'. This transforms every quiz into an intriguing social experiment and a knowledge-based challenge. By analyzing others' opinions, leveraging your insights, and accurately predicting the collective thought, you can pave your way to victory.
        </p>
        <p className="text-gray-800 leading-relaxed">
          With your sharp intellect and foresight, you not only engage with a vibrant community but also stand a chance to win real cash prizes, proving the true value of your opinion.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold gradient-text text-center">The Quiz Dangal Experience</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
            >
              <div className="flex items-start space-x-4">
                <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-3 rounded-full">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Our Principles</h2>
        <div className="space-y-3">
          {principles.map((principle, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
              className="flex items-start space-x-3"
            >
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800 text-sm leading-relaxed">{principle}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.1 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Our Vision</h2>
        <p className="text-gray-800 leading-relaxed">
          Our vision is to become India's most trusted, engaging, and fair platform for opinion-based gaming. We are committed to ensuring that Quiz Dangal provides a safe, transparent, and responsible gaming experience for all users, where everyone can express their opinions and have their skills recognized.
        </p>
        <p className="text-gray-800 leading-relaxed">
          Quiz Dangal is more than just an app; it's a celebration of ideas, a test of skill, and an opportunity to turn your insights into cash.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg"
      >
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Star className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold gradient-text">Join Us Today!</h2>
          <Star className="w-6 h-6 text-yellow-400" />
        </div>
        <p className="text-gray-800 leading-relaxed">
          Join the Quiz Dangal community today and turn your opinions into real rewards!
        </p>
      </motion.div>
    </div>
  );
};

export default AboutUs;