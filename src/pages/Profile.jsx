import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// === Icon Components (No need to install any library) ===
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>;
const FileTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const MessageCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>;
const ShieldIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const ScaleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="m16 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="m2 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>;

export default function Profile() {
  const [supabase, setSupabase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Menu items data
  const menuItems = [
    { icon: FileTextIcon, label: 'About Us', href: '/about-us' },
    { icon: MessageCircleIcon, label: 'Contact Us', href: '/contact-us' },
    { icon: ShieldIcon, label: 'Terms & Conditions', href: '/terms-conditions' },
    { icon: ScaleIcon, label: 'Legality', href: '/legality' },
  ];

  useEffect(() => {
    const scriptId = 'supabase-js-sdk';
    if (document.getElementById(scriptId)) {
      if (window.supabase) {
        const client = window.supabase.createClient('https://wgaunhqkundxxfjguoin.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYXVuaHFrdW5keHhmamd1b2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzQ0NDYsImV4cCI6MjA2ODg1MDQ0Nn0.C5hKQQbm1fDw8mVgQaFvZz5Ok6rrpA1Jmkau7gkuJJU');
        setSupabase(client);
      }
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
    script.async = true;
    script.onload = () => {
      if (window.supabase) {
        const client = window.supabase.createClient('https://wgaunhqkundxxfjguoin.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYXVuaHFrdW5keHhmamd1b2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzQ0NDYsImV4cCI6MjA2ODg1MDQ0Nn0.C5hKQQbm1fDw8mVgQaFvZz5Ok6rrpA1Jmkau7gkuJJU');
        setSupabase(client);
      }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
      else setLoading(false);
    };
    getSession();
  }, [supabase]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
          <div className="relative w-24 h-24 mx-auto mb-2">
            <div className="w-full h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center ring-4 ring-indigo-100">
              <UserIcon />
            </div>
          </div>
          {/* Email Displayed as Text */}
          <p className="text-sm text-gray-500 mb-4">{user?.email}</p>
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
          <button
            onClick={async () => {
              if (supabase) {
                await supabase.auth.signOut();
                window.location.href = '/';
              }
            }}
            className="w-full flex items-center justify-start text-left p-3 h-auto text-red-600 hover:text-red-700 hover:bg-red-50/80 rounded-lg"
          >
            <LogoutIcon />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
