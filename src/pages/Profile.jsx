import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/customSupabaseClient';

// === Icon Components (No need to install any library) ===
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>;
const FileTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const MessageCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>;
const ShieldIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const ScaleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="m16 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="m2 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>;

// A simple message component

export default function Profile() {
  // Supabase client is imported from customSupabaseClient.js
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <UserIcon />
        <p className="mt-4 text-lg text-gray-700">You are not logged in.<br />Please <Link to="/login" className="text-indigo-600 underline">login</Link> to view your profile.</p>
      </div>
    );
  }

  // Menu items data
  const menuItems = [
    { icon: FileTextIcon, label: 'About Us', href: '/about-us' },
    { icon: MessageCircleIcon, label: 'Contact Us', href: '/contact-us' },
    { icon: ShieldIcon, label: 'Terms & Conditions', href: '/terms-conditions' },
    { icon: ScaleIcon, label: 'Legality', href: '/legality' },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
              <UserIcon />
            </div>
            <div className="bg-white/90 rounded-xl px-6 py-4 shadow text-center">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Your Email</h2>
              <p className="text-base text-indigo-600 font-mono break-all">{user.email}</p>
            </div>
          </div>
        </div>
        {/* Menu Items Section */}
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link key={item.label} to={item.href} className="w-full flex items-center justify-start text-left p-3 h-auto text-gray-700 hover:text-gray-900 hover:bg-gray-100/80 rounded-lg">
                <item.icon />
                <span className="font-medium truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
        {/* Logout Section */}
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
          <button onClick={handleSignOut} className="w-full flex items-center justify-start text-left p-3 h-auto text-red-600 hover:text-red-700 hover:bg-red-50/80 rounded-lg">
            <LogoutIcon />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

