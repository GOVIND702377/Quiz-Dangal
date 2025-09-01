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

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 p-3">
      <div className="bg-white/85 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-lg mx-2">
        <div className="flex items-center justify-around py-3 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center py-2 px-1 min-w-0 transition-all duration-200 ease-in-out hover:scale-110 active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Icon
                  size={24}
                  className={`mb-1 ${isActive
                      ? 'text-blue-600'
                      : 'text-gray-500'
                    }`}
                />
                <span className={`text-xs ${isActive
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500'
                  }`}>
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