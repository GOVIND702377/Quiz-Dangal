import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Mail, Phone, Instagram, Facebook, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ContactUs = () => {
  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'For general inquiries, technical assistance, or gameplay questions.',
  contact: 'support@quizdangal.com',
  action: () => window.open('mailto:support@quizdangal.com')
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'For urgent matters or quick assistance.',
      contact: '+91 8905536448',
      action: () => window.open('tel:+918905536448')
    }
  ];

  const socialMedia = [
    {
      icon: Instagram,
      name: 'Instagram',
      color: 'from-pink-500 to-purple-500',
      href: 'https://www.instagram.com/quizdangal?igsh=eGF1OGE4NGgzY2Ry'
    },
    {
      icon: Facebook,
      name: 'Facebook',
      color: 'from-blue-500 to-blue-600',
      href: 'https://www.facebook.com/profile.php?id=61576614092243'
    },
    {
      icon: Twitter,
      name: 'Twitter (X)',
      color: 'from-gray-700 to-black',
      href: 'https://x.com/quizdangal?t=6XBXmd0n87YTF8JstqrKVQ&s=09'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <Helmet>
        <title>Contact Us - Quiz Dangal</title>
        <meta name="description" content="Get in touch with Quiz Dangal team for support, inquiries, and assistance." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold gradient-text mb-4">Contact Us</h1>
        <p className="text-lg text-gray-800 leading-relaxed max-w-2xl mx-auto">
          We value your feedback and are here to assist you. If you have any questions, concerns, or suggestions, please don't hesitate to reach out.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold gradient-text text-center mb-6">Get in Touch Directly</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contactMethods.map((method, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg"
            >
              <div className="text-center space-y-4">
                <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center ring-4 ring-indigo-100">
                  <method.icon className="w-8 h-8 text-white" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{method.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">{method.description}</p>
                  
                  <div className="bg-gray-100/80 rounded-lg p-3 mb-4">
                    <p className="text-gray-800 font-medium">{method.contact}</p>
                  </div>
                  
                  <Button
                    onClick={method.action}
                    className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white font-semibold py-2 rounded-lg"
                  >
                    <method.icon className="w-4 h-4 mr-2" />
                    Contact Now
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold gradient-text text-center mb-6">Connect with Us on Social Media</h2>
        
        <div className="flex justify-center items-center space-x-4 sm:space-x-6">
          {socialMedia.map((platform, index) => (
            <motion.a
              key={index}
              href={platform.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className={`p-4 rounded-full cursor-pointer bg-gradient-to-r ${platform.color} hover:scale-110 transition-transform duration-300 ring-4 ring-white/10 shadow-lg`}
              aria-label={`Visit our ${platform.name} page`}
            >
              <platform.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </motion.a>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ContactUs;