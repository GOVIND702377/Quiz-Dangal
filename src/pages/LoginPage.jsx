import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gcheopiqayyptfxowulv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGVvcGlxYXl5cHRmeG93dWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzQ0NDYsImV4cCI6MjA2ODg1MDQ0Nn0.mVI7HJOEOoMNMRdh6uonCub5G2ggfbGYtIti0x4aAAM'
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setMessage('Name is required.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setMessage('Email and password are required.');
      return;
    }
    setMessage('');
    // Supabase signup
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage('Signup error: ' + error.message);
      return;
    }
    const user = data.user;
    if (!user || !user.id) {
      setMessage('Signup failed: No user returned.');
      return;
    }
    // Insert profile with full_name and wallet_balance
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          full_name: fullName,
          email: email,
          phone_number: phoneNumber,
          wallet_balance: 0
        }
      ]);
    if (profileError) {
      setMessage('Profile creation error: ' + profileError.message);
      return;
    }
    setMessage('Signup and profile creation successful!');
    setTimeout(() => {
      navigate('/profile');
    }, 1500);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Sign Up</h2>
        <form onSubmit={handleSignup} className="space-y-4 text-left">
          <div>
            <label htmlFor="fullName" className="text-sm font-medium text-gray-600">Full Name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Name" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-600">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-600">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-medium text-gray-600">Mobile Number</label>
            <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          {message && <div className={`border px-4 py-3 rounded-lg relative ${message.startsWith('Signup') || message.startsWith('Profile') ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'} mt-4`} role="alert">{message}</div>}
          <button type="submit" className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg shadow-md disabled:opacity-50">
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}
