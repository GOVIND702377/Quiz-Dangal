import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Trophy, Wallet, User } from 'lucide-react';

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Trophy, label: 'My Quizzes', path: '/my-quizzes' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <motion.footer 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
    <div className="mx-auto max-w-2xl px-4 pb-2">
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/60 rounded-xl shadow-lg">
          <nav className="grid grid-cols-4 gap-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
          className={`nav-item flex flex-col items-center space-y-1 h-16 justify-center rounded-lg ${
                    isActive ? 'active' : ''
                  }`}
                >
          <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
          <span className="text-[10px] sm:text-xs text-center leading-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;