import React from 'react';
// Removed framer-motion for lighter public page
import SEO from '@/components/SEO';
import { Mail, Phone, Instagram, Facebook, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBrandGradient } from '@/lib/brand';

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
      contact: '+91 9587803557',
      action: () => window.open('tel:+919587803557')
    }
  ];

  const socialMedia = [
    {
      icon: Instagram,
      name: 'Instagram',
      color: 'from-fuchsia-600 to-rose-500',
      href: 'https://www.instagram.com/quizdangal?igsh=eGF1OGE4NGgzY2Ry'
    },
    {
      icon: Facebook,
      name: 'Facebook',
      color: 'from-indigo-600 to-blue-600',
      href: 'https://www.facebook.com/profile.php?id=61576614092243'
    },
    {
      icon: Twitter,
      name: 'Twitter (X)',
      color: 'from-slate-600 to-black',
      href: 'https://x.com/quizdangal?t=6XBXmd0n87YTF8JstqrKVQ&s=09'
    }
  ];

  return (
  <div className="min-h-screen text-slate-100">
      <div className="container mx-auto px-4 py-6 space-y-8">
      <SEO
        title="Contact Us – Quiz Dangal"
        description="Get in touch with the Quiz Dangal support team for help, partnerships, and media inquiries."
        canonical="https://quizdangal.com/contact-us"
        keywords={['quiz dangal contact', 'quiz dangal support', 'quiz dangal phone', 'quiz dangal email']}
      />

      <div className="text-center mb-8">
  <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-4">Contact Us</h1>
  <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
          We value your feedback and are here to assist you. If you have any questions, concerns, or suggestions, please don&apos;t hesitate to reach out.
        </p>
      </div>
      
      <div className="space-y-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent text-center mb-6">Get in Touch Directly</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contactMethods.map((method, index) => (
            <div
              key={index}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 shadow-lg"
            >
              <div className="text-center space-y-4">
                <div className={`bg-gradient-to-r ${getBrandGradient(index)} p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center ring-4 ring-white/10`}>
                  <method.icon className="w-8 h-8 text-white" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">{method.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{method.description}</p>
                  
                  <div className="bg-slate-800/60 rounded-lg p-3 mb-4 border border-slate-700/60">
                    <p className="text-slate-200 font-medium">{method.contact}</p>
                  </div>
                  
                  <Button
                    onClick={method.action}
                    className={`w-full bg-gradient-to-r ${getBrandGradient(index)} hover:brightness-110 text-white font-semibold py-2 rounded-lg`}
                  >
                    <method.icon className="w-4 h-4 mr-2" />
                    Contact Now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
  <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent text-center mb-6">Connect with Us on Social Media</h2>
        
        <div className="flex justify-center items-center space-x-4 sm:space-x-6">
          {socialMedia.map((platform, index) => (
            <a
              key={index}
              href={platform.href}
              target="_blank"
              rel="noopener noreferrer"
        className={`p-4 rounded-full cursor-pointer bg-gradient-to-r ${platform.color} hover:scale-110 transition-transform duration-300 ring-4 ring-white/10 shadow-lg`}
              aria-label={`Visit our ${platform.name} page`}
            >
              <platform.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </a>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ContactUs;