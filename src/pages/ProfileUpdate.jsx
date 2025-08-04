import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Spinner from '@/components/Spinner';

export default function ProfileUpdate() {
  const { user, supabase, userProfile, loading, refreshUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // STEP 4: Protect /profile-update route
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setPhoneNumber(userProfile.phone_number || '');
    }
  }, [userProfile]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    // STEP 3: Improve user fetching with fallback
    let currentUser = user;
    if (!currentUser) {
      const { data, error } = await supabase.auth.getUser();
      currentUser = data?.user;
      if (!currentUser) {
        setMessage('Error: User not logged in. Please login again.');
        return;
      }
    }
    
    if (!supabase) {
      setMessage('Error: Database connection not available. Please refresh the page.');
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
      console.log('=== PROFILE UPDATE DEBUG ===');
      console.log('Current user object:', currentUser);
      
      if (!currentUser || !currentUser.id) {
        console.error("Critical Error: User ID is not available. Aborting update.");
        setMessage("Error: Your session seems to be invalid. Please log out and log in again.");
        setSaving(false);
        return;
      }

      console.log('Current user ID:', currentUser.id);
      console.log('Supabase client:', supabase);
      console.log('Full name:', fullName);
      console.log('Phone number:', phoneNumber);
      
      // First check if profile exists
      console.log('Checking if profile exists...');
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      console.log('Existing profile check - data:', existingProfile);
      console.log('Existing profile check - error:', checkError);
      
      const updates = {
        full_name: fullName.trim(),
        phone_number: phoneNumber,
        updated_at: new Date().toISOString(),
      };
      
      console.log('Updates object:', updates);
      
      let result;
      if (!existingProfile) {
        // Profile doesn't exist, create it
        console.log('Profile not found, creating new profile...');
        result = await supabase
          .from('profiles')
          .insert([{
            id: currentUser.id,
            email: currentUser.email,
            ...updates
          }])
          .select();
      } else {
        // Profile exists, update it
        console.log('Profile found, updating existing profile...');
        result = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentUser.id)
          .select();
      }
      
      const { data, error } = result;
      console.log('Supabase operation result - data:', data);
      console.log('Supabase operation result - error:', error);
      
      // Additional RLS debugging
      if (error) {
        console.log('=== RLS DEBUG INFO ===');
        console.log('Error code:', error.code);
        console.log('Error message:', error.message);
        console.log('Error details:', error.details);
        console.log('Error hint:', error.hint);
        console.log('Current user auth:', currentUser);
        console.log('User metadata:', currentUser?.user_metadata);
        console.log('User app metadata:', currentUser?.app_metadata);
        console.error('Supabase operation error details:', error);
        throw error;
      }
      
      console.log('Profile updated successfully:', data);
      setMessage('Profile updated successfully!');
      
      // STEP 2: Fix refreshUserProfile call with user argument
      console.log('Refreshing user profile...');
      await refreshUserProfile(currentUser);
      
      setTimeout(() => {
        setMessage('');
        navigate('/profile');
      }, 1500);
      
    } catch (error) {
      console.error('=== PROFILE UPDATE ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setMessage(`Error updating profile: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Spinner className="h-12 w-12 text-indigo-500" /></div>;
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
            {saving ? <Spinner className="h-5 w-5" /> : 'Save Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
