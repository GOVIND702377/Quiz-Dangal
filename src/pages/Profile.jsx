import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// === Icon Components (No need to install any library) ===
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const SaveIcon = ({ isLoading }) => isLoading ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>;
const FileTextIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const MessageCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>;
const ShieldIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const ScaleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-3 flex-shrink-0"><path d="m16 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="m2 16 3-8 3 8c-2 1-4 1-6 0"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>;

// A simple message component
const AlertMessage = ({ message, type = 'error' }) => {
  if (!message) return null;
  const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700';
  return (
    <div className={`border px-4 py-3 rounded-lg relative ${bgColor} mt-4`} role="alert">
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default function Profile() {
  const [supabase, setSupabase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');

  // Menu items data
  const menuItems = [
    { icon: FileTextIcon, label: 'About Us', href: '/about-us' },
    { icon: MessageCircleIcon, label: 'Contact Us', href: '/contact-us' },
    { icon: ShieldIcon, label: 'Terms & Conditions', href: '/terms-conditions' },
    { icon: ScaleIcon, label: 'Legality', href: '/legality' },
  ];

  // Effect to load Supabase script from CDN and initialize client
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

  useEffect(() => {
    if (!user || !supabase) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error && error.message !== 'JSON object requested, multiple (or no) rows returned') throw error;
        if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          setPhoneNumber(data.phone_number || '');
        }
      } catch (error) {
        setMessage(`Error fetching profile: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, supabase]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    if (phoneNumber && phoneNumber.length !== 10) {
        setMessage("Please enter a valid 10-digit mobile number.");
        return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updates = { id: user.id, full_name: fullName, phone_number: phoneNumber, updated_at: new Date() };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      setMessage('Profile updated successfully!');
      // Set a timer to clear the success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Error updating profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (supabase) supabase.auth.signOut();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
          <div className="relative w-24 h-24 mx-auto mb-2">
            <div className="w-full h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center ring-4 ring-indigo-100">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <UserIcon />
              )}
            </div>
          </div>
          {/* Email Displayed as Text */}
          <p className="text-sm text-gray-500 mb-4">{user?.email}</p>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4 text-left">
            <div>
              <label htmlFor="fullName" className="text-sm font-medium text-gray-600">Full Name</label>
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Name" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
            <div>
              <label htmlFor="phone" className="text-sm font-medium text-gray-600">Mobile Number</label>
              <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            {message && <AlertMessage message={message} type={message.startsWith('Error') ? 'error' : 'success'} />}
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg shadow-md disabled:opacity-50">
              <SaveIcon isLoading={saving} />
              {!saving && "Save Details"}
            </button>
          </form>
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
