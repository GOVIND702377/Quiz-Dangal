import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/customSupabaseClient";
import { Loader2, Crown, Wallet, TrendingUp, TrendingDown, Flame, Globe, Share2, Camera } from 'lucide-react';

function StatCard({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg flex items-center ${className}`}>
      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
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
    { label: "About Us", href: "/about-us" },
    { label: "Contact Us", href: "/contact-us" },
    { label: "Terms & Conditions", href: "/terms-conditions" },
    { label: "Privacy Policy", href: "/privacy-policy" },
  ];
  const extraItems = [
    { label: 'Language', onClick: () => alert('Languages coming soon'), icon: Globe },
    { label: 'Share', onClick: shareApp, icon: Share2 },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-600 font-bold">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{(profile?.full_name || sessionUser?.email || 'U').charAt(0).toUpperCase()}</span>
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
              <div className="text-sm text-gray-500">Logged in as</div>
              <div className="text-xl font-semibold text-gray-800 break-all">{profile?.email || sessionUser.email}</div>
              <div className="text-sm text-gray-600">{profile?.full_name || 'Anonymous'}{profile?.username ? ` • @${profile.username}` : ''}</div>
              {/* Badges inline */}
              <div className="mt-2">
                {Array.isArray(profile?.badges) && profile.badges.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.badges.slice(0, 6).map((b, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">{b}</span>
                    ))}
                    {profile.badges.length > 6 && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 border border-gray-200 text-gray-600">+{profile.badges.length - 6}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No badges yet</div>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Level</div>
            <div className="text-2xl font-bold text-indigo-600">{profile?.level || '—'}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Wallet" value={Number(profile?.wallet_balance || 0)} />
        <StatCard icon={TrendingUp} label="Total Earned" value={Number(profile?.total_earned || 0)} />
        <StatCard icon={TrendingDown} label="Total Spent" value={Number(profile?.total_spent || 0)} />
        <StatCard icon={Flame} label="Streak" value={Number(profile?.streak_count || 0)} />
      </div>

  {/* Badges moved to header */}

  {/* Referral section removed as requested */}

    {/* Menu */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <div className="grid grid-cols-2 gap-2">
      {menuItems.map((item) => (
            <Link key={item.href} to={item.href} className="px-3 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 text-center">
              {item.label}
            </Link>
          ))}
          {extraItems.map((item, idx) => (
            <button key={idx} onClick={item.onClick} className="px-3 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 text-center flex items-center justify-center gap-2">
              {item.icon ? <item.icon className="w-4 h-4" /> : null}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 shadow-lg">
        <button
          onClick={handleSignOut}
          className="w-full px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
