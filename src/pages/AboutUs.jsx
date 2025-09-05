import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Target, Users, Trophy, Shield, CheckCircle, Star } from 'lucide-react';

const AboutUs = () => {
  // Updated copy: "Why Choose Quiz Dangal?" items
  const features = [
    {
      icon: Target,
      title: 'Daily Quizzes',
      description: 'Fresh opinion-based and knowledge-based quizzes every day. Learn something new while you play.'
    },
    {
      icon: Trophy,
      title: 'Competition & Leaderboards',
      description: 'Improve your rank and prove yourself as the true quiz champion.'
    },
    {
      icon: Shield,
      title: 'Coins & Rewards System',
      description: 'Earn coins for every correct answer and redeem them for exciting rewards.'
    },
    {
      icon: Target,
      title: 'Daily Login Streaks',
      description: 'Get bonus coins for logging in every day and maintain your streak.'
    },
    {
      icon: Users,
      title: 'Refer & Earn Program',
      description: 'Invite your friends, play together, and earn extra rewards.'
    },
    {
      icon: Shield,
      title: 'Transparent Results',
      description: 'Every quiz result and leaderboard is fair and clear, ensuring equal opportunities for all players.'
    }
  ];

  // Updated copy: Trust, Safety & Fair Play
  const principles = [
    'Every quiz is fair and transparent.',
    'User data and transactions are fully secure and protected.',
    'Every player gets an equal chance to win.'
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <Helmet>
  <title>About Us – Quiz Dangal</title>
  <meta name="description" content="Quiz Dangal – India’s most exciting quiz and rewards platform where knowledge meets entertainment." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold gradient-text mb-4">About Us – Quiz Dangal</h1>
        <p className="text-lg text-gray-800 leading-relaxed">
          Welcome to Quiz Dangal – India’s most exciting quiz and rewards platform where knowledge meets entertainment!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Our Vision & Mission</h2>
        <p className="text-gray-800 leading-relaxed">
          We built Quiz Dangal with the mission to give everyone a fair chance to showcase their talent, challenge their mind, and win exciting rewards. Here, it’s not just about playing quizzes – it’s about learning, competing, and enjoying at the same time.
        </p>
        <p className="text-gray-800 leading-relaxed">
          Our mission is simple: <strong>“To make quizzing fun, fair, and rewarding for everyone.”</strong>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 space-y-4 shadow-lg"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Why Choose Quiz Dangal?</h2>
        <p className="text-gray-800 leading-relaxed">
          In today’s fast-paced world, people want entertainment that is also meaningful. That’s why Quiz Dangal brings you a unique blend of fun and rewards.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-6"
      >
  <h2 className="text-2xl font-bold gradient-text text-center">Why Choose Quiz Dangal?</h2>
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
  <h2 className="text-2xl font-bold gradient-text mb-4">Trust, Safety & Fair Play</h2>
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
          Quiz Dangal is not just an app – it’s a community of quiz lovers where players learn, enjoy, and turn their knowledge into real rewards. We believe that knowledge is power, and competing with knowledge makes the experience even more exciting.
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
          The Quiz Dangal Promise: Stay engaged daily, learn something new, compete with others, and win rewards along the way.
        </p>
        <p className="text-gray-800 leading-relaxed font-semibold">Quiz Dangal – Play. Compete. Win.</p>
      </motion.div>
    </div>
  );
};

export default AboutUs;