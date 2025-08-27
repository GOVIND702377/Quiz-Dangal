import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/customSupabaseClient";
import { Loader2, Crown, Camera, LogOut, ChevronRight } from 'lucide-react';

// Removed StatCard and stats grid as requested

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user || null;
      setSessionUser(u);
      if (u) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, username, avatar_url, wallet_balance, total_earned, total_spent, streak_count, badges, level')
          .eq('id', u.id)
          .single();
        if (error) throw error;
        setProfile(data);
        setNewUsername(data?.username || "");
      } else {
        setProfile(null);
      }
    } catch (e) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const shareApp = async () => {
    const link = window.location.origin;
    const text = 'Join me on Quiz Dangal — Play daily quizzes, win coins and redeem rewards!';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Quiz Dangal', text, url: link });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} ${link}`);
        alert('Share text copied');
      } else {
        window.prompt('Share this text:', `${text} ${link}`);
      }
    } catch {}
  };

  const onChooseAvatar = () => fileInputRef.current?.click();
  const onAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sessionUser) return;
    setUploading(true);
    try {
      const path = `${sessionUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = await supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Could not get public URL');
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', sessionUser.id);
      if (updErr) throw updErr;
      await load();
      alert('Avatar updated');
    } catch (err) {
      alert(`Avatar change failed: ${err?.message || 'Try again later'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Level ring + meta
  const getLevelRingClass = (lvl) => {
    const n = Number(lvl || 0);
    if (n >= 20) return 'ring-[#8b5cf6]'; // purple/diamond
    if (n >= 10) return 'ring-[#f59e0b]'; // gold
    if (n >= 5) return 'ring-[#9ca3af]'; // silver
    return 'ring-[#cd7f32]'; // bronze
  };
  const getLevelTitle = (lvl) => {
    const n = Number(lvl || 0);
    if (n >= 20) return 'Legend';
    if (n >= 10) return 'Pro';
    if (n >= 5) return 'Explorer';
    return 'Rookie';
  };
  const getLevelProgress = (totalEarned) => {
    const earned = Number(totalEarned || 0);
    const target = 100; // assumption: 100 coins per level
    const pct = Math.max(0, Math.min(100, Math.round((earned % target) / target * 100)));
    return pct;
  };

  const ALL_BADGES = ['Rookie', 'Explorer', 'Challenger', 'Pro', 'Legend', 'Streak 7', 'Streak 30', 'Top 10', 'Winner', 'Referral Pro'];
  const unlocked = Array.isArray(profile?.badges) ? profile.badges : [];
  const locked = ALL_BADGES.filter(b => !unlocked.includes(b));

  const startEditUsername = () => {
    setNewUsername(profile?.username || "");
    setEditingUsername(true);
  };
  const saveUsername = async () => {
    if (!sessionUser) return;
    const u = (newUsername || '').trim();
    if (!u) return alert('Username cannot be empty');
    try {
      setSavingUsername(true);
      const { error } = await supabase.from('profiles').update({ username: u }).eq('id', sessionUser.id);
      if (error) throw error;
      await load();
      setEditingUsername(false);
      alert('Username updated');
    } catch (err) {
      alert(err?.message || 'Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
          <Crown className="w-6 h-6" />
        </div>
        <p className="text-lg text-gray-700">
          You are not logged in or session expired.
          <br />
          Please <Link to="/login" className="text-indigo-600 underline">login</Link> to view your profile.
        </p>
      </div>
    );
  }

  const menuItems = [
    { label: 'About Us', href: '/about-us', emoji: 'ℹ️', bg: 'bg-gray-100', fg: 'text-gray-700' },
    { label: 'Contact Us', href: '/contact-us', emoji: '📞', bg: 'bg-gray-100', fg: 'text-gray-700' },
    { label: 'Terms & Conditions', href: '/terms-conditions', emoji: '📜', bg: 'bg-gray-100', fg: 'text-gray-700' },
    { label: 'Privacy Policy', href: '/privacy-policy', emoji: '🔒', bg: 'bg-gray-100', fg: 'text-gray-700' },
    { label: 'Language', onClick: () => alert('Languages coming soon'), emoji: '🌍', bg: 'bg-gray-100', fg: 'text-gray-700' },
    { label: 'Share', onClick: shareApp, emoji: '📤', bg: 'bg-gray-100', fg: 'text-gray-700' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-gray-700 font-bold ring-2 ring-offset-2 ${getLevelRingClass(profile?.level)}`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 animate-pulse">
                    <span className="text-lg">
                      {(profile?.full_name || sessionUser?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={onChooseAvatar}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white border shadow text-gray-700 hover:bg-gray-50"
                title={uploading ? 'Uploading…' : 'Change avatar'}
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
            </div>
            <div>
              <div className="text-xs text-gray-500">Email</div>
              <div className="text-lg font-semibold text-gray-800 break-all">{profile?.email || sessionUser.email}</div>
              <div className="mt-1 text-xs text-gray-500">Public handle</div>
              {!editingUsername ? (
                <div className="flex items-center gap-2 text-sm text-gray-800">
                  <span className="font-medium">{profile?.username ? `@${profile.username}` : 'Not set'}</span>
                  <button onClick={startEditUsername} className="px-2 py-0.5 text-xs rounded-md border bg-white hover:bg-gray-50">Edit</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="px-2 py-1 text-sm rounded-md border outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="your_username"
                  />
                  <button onClick={saveUsername} disabled={savingUsername} className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
                    {savingUsername ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingUsername(false)} className="px-2 py-1 text-xs rounded-md border bg-white hover:bg-gray-50">Cancel</button>
                </div>
              )}
              <button onClick={() => setShowBadges((v) => !v)} className="mt-2 text-xs text-indigo-700 underline">{showBadges ? 'Hide badges' : 'View badges'}</button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Level {profile?.level ?? '—'} – {getLevelTitle(profile?.level)}</div>
            <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${getLevelProgress(profile?.total_earned)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-gray-500">{getLevelProgress(profile?.total_earned)}% to next level</div>
          </div>
        </div>
      </div>

  {/* Stats removed as requested */}

      {/* Badges Section */}
      {showBadges && (
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
          <div className="text-sm font-medium text-gray-800 mb-2">Badges</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {unlocked.length > 0 ? unlocked.map((b, i) => (
              <span key={`u-${i}`} className="px-2 py-1 text-xs rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">{b}</span>
            )) : <span className="text-xs text-gray-500">No badges unlocked yet</span>}
          </div>
          <div className="text-xs text-gray-500 mb-1">Locked</div>
          <div className="flex flex-wrap gap-2">
            {locked.map((b, i) => (
              <span key={`l-${i}`} className="px-2 py-1 text-xs rounded-full bg-gray-100 border border-gray-200 text-gray-500">🔒 {b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Menu (vertical list with icons, colored pills) */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-2 shadow-lg">
        <div className="flex flex-col gap-2">
          {menuItems.map((item, idx) => {
            const content = (
              <div className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center ${item.bg} ${item.fg}`}>
                    <span className="text-base" aria-hidden>{item.emoji}</span>
                  </span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            );
            return item.href ? (
              <Link key={idx} to={item.href}>
                {content}
              </Link>
            ) : (
              <button key={idx} onClick={item.onClick} className="text-left">
                {content}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout (same style item at bottom) */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-2 shadow-lg">
        <button onClick={handleSignOut} className="w-full text-left">
          <div className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-sm text-red-600">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </span>
              <span className="font-medium">Logout</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
