import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/customSupabaseClient";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Crown, Camera, LogOut, ChevronRight, Info, Mail, FileText, Shield, Globe, Share2, Coins, Flame, Award, Sparkles } from 'lucide-react';

// Removed StatCard and stats grid as requested

export default function Profile() {
  const { signOut } = useAuth();
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
    await signOut();
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
    { label: 'About Us', href: '/about-us', icon: Info },
    { label: 'Contact Us', href: '/contact-us', icon: Mail },
    { label: 'Terms & Conditions', href: '/terms-conditions', icon: FileText },
    { label: 'Privacy Policy', href: '/privacy-policy', icon: Shield },
    { label: 'Language', href: '/language', icon: Globe },
    { label: 'Share', onClick: shareApp, icon: Share2 },
  ];

  return (
  <div className="min-h-[100svh] bg-indigo-50">
  <div className="container mx-auto px-2 md:px-3 py-0 max-w-3xl space-y-3">
        {/* Header */}
  <div className="group relative overflow-hidden rounded-3xl p-4 bg-white/70 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40">
          {/* subtle decorative gradient */}
          <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-tr from-indigo-200/60 via-fuchsia-200/50 to-transparent blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-purple-200/50 via-pink-200/40 to-transparent blur-3xl" />
          <div className="flex flex-col gap-4 relative">
            {/* Left: Avatar + Email */}
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center -ml-2">
              <div className="relative w-[5.5rem] h-[5.5rem]">
                {/* soft animated glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-400/20 via-fuchsia-400/20 to-transparent blur-[3px] animate-spin" style={{ animationDuration: '9s' }} />
                <div className={`relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden flex items-center justify-center text-gray-700 font-bold ring-2 ring-offset-2 ${getLevelRingClass(profile?.level)} bg-gradient-to-br from-gray-50 to-gray-100 shadow-md`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl">
                        {(profile?.full_name || sessionUser?.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onChooseAvatar}
                  disabled={uploading}
                  className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-white/90 border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
                  title={uploading ? 'Uploading…' : 'Change avatar'}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
              </div>
              {/* Email under avatar */}
              <div className="mt-2 text-center">
                <div className="text-[11px] text-gray-500">Email</div>
                <div className="text-sm font-medium text-gray-800 whitespace-nowrap overflow-x-auto">{profile?.email || sessionUser.email}</div>
              </div>
              </div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Welcome back</span>
                </div>
                <div className="text-sm font-semibold text-gray-800 truncate">{profile?.username ? `@${profile.username}` : 'Username not set'}</div>
                {/* Quick stats: only Earned */}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    <Award className="w-3.5 h-3.5" />
                    <span className="font-medium">{Number(profile?.total_earned ?? 0).toLocaleString()} Earned</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Right: Level + Progress (keep stacked like mobile) */}
            <div className="w-full">
              <div className="mt-2 inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100">Level {profile?.level ?? '—'}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-50 text-gray-600 border border-gray-200">{getLevelTitle(profile?.level)}</span>
              </div>
              <div className="mt-2 relative h-2.5 bg-gray-200/70 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-white/30" />
                <div className="relative h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 shadow-[0_0_12px_rgba(99,102,241,0.35)]" style={{ width: `${getLevelProgress(profile?.total_earned)}%` }} />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-600">{getLevelProgress(profile?.total_earned)}%</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">to next level</div>
              <button onClick={() => setShowBadges((v) => !v)} className="mt-2 text-xs text-indigo-700 hover:text-indigo-800 underline">{showBadges ? 'Hide badges' : 'View badges'}</button>
            </div>
            {/* Bottom-left action */}
            <div className="pt-3 mt-1 w-full border-t border-gray-100">
              <Link to="/profile-update" className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow hover:shadow-md text-sm transition">
                Edit Profile
              </Link>
            </div>
          </div>
        </div>

      {/* Badges Section */}
        {showBadges && (
          <div className="rounded-3xl p-4 bg-white/70 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40">
            <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Your Badges</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {unlocked.length > 0 ? (
                unlocked.map((b, i) => (
                  <span key={`u-${i}`} className="px-2.5 py-1.5 text-[11px] rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 shadow-sm">
                    ✨ {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">No badges unlocked yet</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-1">Locked</div>
            <div className="flex flex-wrap gap-2">
              {locked.map((b, i) => (
                <span key={`l-${i}`} className="px-2.5 py-1.5 text-[11px] rounded-full bg-gray-50 border border-gray-200 text-gray-500">🔒 {b}</span>
              ))}
            </div>
          </div>
        )}

      {/* Menu (vertical list with simple icons) */}
  <div className="rounded-3xl p-3 bg-white/70 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40">
          <div className="flex flex-col gap-3">
            {menuItems.map((item, idx) => {
              const content = (
    <div className="group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-gray-100/70 bg-white/80 hover:bg-white transition shadow-sm hover:shadow-md text-sm text-gray-800 cursor-pointer">
                  <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100 group-hover:scale-[1.03] transition">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold tracking-wide">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition" />
                </div>
              );
              return item.href ? (
                <Link key={idx} to={item.href} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded-2xl">
                  {content}
                </Link>
              ) : (
                <button key={idx} onClick={item.onClick} className="text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded-2xl">
                  {content}
                </button>
              );
            })}
          </div>
        </div>

      {/* Logout (styled like menu items, keep red palette) */}
        <div className="rounded-3xl p-3 bg-white/70 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40">
          <button onClick={handleSignOut} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-red-200 rounded-2xl">
            <div className="group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-red-100 bg-white/80 hover:bg-white transition shadow-sm hover:shadow-md text-sm text-red-600 cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm border border-red-100 group-hover:scale-[1.03] transition">
                  <LogOut className="w-4 h-4" />
                </span>
                <span className="font-semibold tracking-wide">Logout</span>
              </div>
              <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-red-400 transition" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
