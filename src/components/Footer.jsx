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

  // Refined active palette inspired by the logo's ring and trophy
  // Home: Blue, Leaderboards: Pink, My Quizzes: Purple, Wallet: Gold, Profile: Indigo
  const activeColor = (path) => {
    switch (path) {
      case '/': return 'text-accent-d';        // blue
      case '/leaderboards': return 'text-accent-a'; // pink/fuchsia
      case '/my-quizzes': return 'text-accent-c';   // purple
      case '/wallet': return 'text-accent-e';       // gold
      case '/profile': return 'text-accent-b';      // indigo
      default: return 'text-accent-d';
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
  <div className="qd-card rounded-3xl mx-1 sm:mx-2 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] overflow-hidden">
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
                    strokeWidth={2.8}
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
      </div>
    </footer>
  );
};

export default Footer;