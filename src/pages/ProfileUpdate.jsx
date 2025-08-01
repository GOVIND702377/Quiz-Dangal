import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProfileUpdate() {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

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
      setLoading(false);
    };
    getSession();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const fetchProfile = async () => {
      // Null check for user and user.id
      if (!user || !user.id) {
        setMessage('Error: User not logged in. Please login again.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error && error.message !== 'JSON object requested, multiple (or no) rows returned') throw error;
        if (data) {
          setFullName(data.full_name || '');
          setPhoneNumber(data.phone_number || '');
        } else {
          setMessage('No profile data found for this user.');
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
    // Null check for user and user.id
    if (!user || !user.id) {
      setMessage('Error: User not logged in. Please login again.');
      return;
    }
    if (!fullName.trim()) {
      setMessage('Name is required.');
      return;
    }
    if (!phoneNumber || phoneNumber.length !== 10) {
      setMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updates = {
        full_name: fullName,
        phone_number: phoneNumber,
        updated_at: new Date(),
      };
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;
      setMessage('Profile updated successfully!');
      setTimeout(() => {
        setMessage('');
        navigate('/profile');
      }, 1500);
    } catch (error) {
      setMessage(`Error updating profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Update Your Profile</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4 text-left">
          <div>
            <label htmlFor="fullName" className="text-sm font-medium text-gray-600">Full Name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Name" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-medium text-gray-600">Mobile Number</label>
            <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          {message && <div className={`border px-4 py-3 rounded-lg relative ${message.startsWith('Error') ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'} mt-4`} role="alert">{message}</div>}
          <button type="submit" disabled={saving} className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg shadow-md disabled:opacity-50">
            {saving ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> : 'Save Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
