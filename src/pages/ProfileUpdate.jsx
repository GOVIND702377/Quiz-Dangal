import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import Spinner from '@/components/Spinner';

export default function ProfileUpdate() {
  const { user, supabase, userProfile, loading, refreshUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // New: username + avatar states
  const [username, setUsername] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Protect route
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Prefill from profile (only once to avoid clobbering while user types)
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (userProfile && !prefilledRef.current) {
      setFullName(userProfile.full_name || '');
      setPhoneNumber(userProfile.phone_number || '');
      setUsername(userProfile.username || '');
      setAvatarUrl(userProfile.avatar_url || '');
      prefilledRef.current = true;
    }
  }, [userProfile]);

  // Username availability check (case-insensitive)
  const checkUsername = useCallback(async (value) => {
    const v = (value || '').trim();
    if (!v) { setUsernameAvailable(true); return; }
    setUsernameChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', v)
        .neq('id', user?.id)
        .limit(1);
      if (error) throw error;
      setUsernameAvailable(!data || data.length === 0);
    } catch {
      setUsernameAvailable(true); // fail-open
    } finally {
      setUsernameChecking(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    const t = setTimeout(() => { checkUsername(username); }, 400);
    return () => clearTimeout(t);
  }, [username, checkUsername]);

  const handleAvatarUpload = async (file) => {
    if (!file || !user) return;
    setAvatarUploading(true);
    setMessage('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext || 'jpg'}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) {
        const msg = (upErr?.message || '').toLowerCase();
        if (msg.includes('not found') || msg.includes('no such bucket')) {
          throw new Error('Storage bucket "avatars" not found. Create a public bucket named "avatars" in Supabase Storage and allow public READ.');
        }
        throw upErr;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('Failed to get avatar URL');
      setAvatarUrl(publicUrl);
      setMessage('Avatar uploaded. Remember to Save Details.');
    } catch (e) {
      setMessage(`Error uploading avatar: ${e.message || 'Unknown error'}`);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setMessage('Name is required.');
      return;
    }
    // Phone required: must be 10 digits
    if (!phoneNumber || phoneNumber.length !== 10) {
      setMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    const uname = (username || '').trim();
    // Username now required and public (a-z, 0-9, underscore, 3-20 chars)
    const validUname = /^[a-z0-9_]{3,20}$/.test(uname);
    if (!uname) {
      setMessage('Username is required and will be publicly visible on leaderboards and results.');
      return;
    }
    if (!validUname) {
      setMessage('Username must be 3-20 chars, lowercase letters, numbers, and underscore only.');
      return;
    }
    if (!usernameAvailable) {
      setMessage('Chosen username is not available. Please pick another.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        setMessage('Error: User not authenticated. Please login again.');
        setSaving(false);
        return;
      }

  const updates = {
        full_name: fullName.trim(),
  phone_number: phoneNumber,
        updated_at: new Date().toISOString(),
      };
  // store validated username (lowercase)
  updates.username = uname.toLowerCase();
      if (avatarUrl) updates.avatar_url = avatarUrl;

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: currentUser.id, email: currentUser.email, ...updates })
        .select();
      if (error) throw error;

  setMessage('Profile updated successfully!');
  // Keep local state in sync after save
  prefilledRef.current = true;
      await refreshUserProfile(currentUser);

      setTimeout(() => { setMessage(''); navigate('/profile'); }, 1200);
    } catch (error) {
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
          {/* Avatar */}
          <div>
            <label className="text-sm font-medium text-gray-600">Avatar</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-600 font-bold">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{(userProfile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <label className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm cursor-pointer">
                {avatarUploading ? 'Uploading...' : 'Upload Avatar'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setAvatarFile(f || null);
                    if (f) handleAvatarUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="text-sm font-medium text-gray-600">Username <span className="text-red-500">*</span></label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              onBlur={(e) => checkUsername(e.target.value)}
              placeholder="your_public_name"
              autoComplete="username"
              autoFocus
              className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="mt-1 text-xs">
              {usernameChecking ? (
                <span className="text-gray-500">Checking availability...</span>
              ) : username ? (
                usernameAvailable ? <span className="text-green-600">Available</span> : <span className="text-red-600">Not available</span>
              ) : (
                <span className="text-gray-500">This will be visible to everyone on results and leaderboards.</span>
              )}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="text-sm font-medium text-gray-600">Full Name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your Name" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="text-sm font-medium text-gray-600">Mobile Number <span className="text-red-500">*</span></label>
            <input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" required pattern="\d{10}" className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          {/* Save message */}
          {message && (
            <div className={`border px-4 py-3 rounded-lg relative ${message.startsWith('Error') ? 'bg-red-100 border-red-400 text-red-700' : message.startsWith('Error') ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'} mt-2`} role="alert">{message}</div>
          )}

          <button type="submit" disabled={saving || avatarUploading || (!usernameAvailable && !!username)} className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg shadow-md disabled:opacity-50">
            {saving ? <Spinner className="h-5 w-5" /> : 'Save Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
