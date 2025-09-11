import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, User, Medal, Trophy } from 'lucide-react';

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Medal, label: 'Leaderboards', path: '/leaderboards' },
    { icon: Trophy, label: 'My Quizzes', path: '/my-quizzes' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const activeColor = (path) => {
    switch (path) {
      case '/': return 'text-sky-400'; // Home → sky blue (logo tone)
      case '/leaderboards': return 'text-amber-300';
      case '/my-quizzes': return 'text-fuchsia-300';
      case '/wallet': return 'text-amber-300';
      case '/profile': return 'text-purple-400'; // Profile → purple (logo tone)
      default: return 'text-sky-400';
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 p-2">
      <div className="qd-glass-soft rounded-3xl mx-1 sm:mx-2 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-around py-2 px-2 sm:px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-2 min-w-0 transition-all duration-200 ease-in-out hover:scale-110 active:scale-95 ${isActive ? 'qd-active-underline' : ''}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
        <span className="relative">
                  <Icon
          size={24}
          strokeWidth={2.2}
          className={`mb-1 drop-shadow ${isActive ? activeColor(item.path) : 'text-white/80'}`}
                  />
                </span>
        <span className={`text-[10px] font-semibold tracking-wide ${isActive ? activeColor(item.path) : 'text-white/85'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="h-[3px] w-full bg-gradient-to-r from-[#ffe06b] via-[#ff8d8d] to-[#ff73d9] opacity-80" />
      </div>
    </footer>
  );
};

export default Footer;