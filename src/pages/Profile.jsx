import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/customSupabaseClient";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Camera, LogOut, ChevronRight, Info, Mail, FileText, Shield, Share2, Sparkles, BellRing, Coins } from 'lucide-react';
import ProfileUpdateModal from '@/components/ProfileUpdateModal';

export default function Profile() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [nextInfo, setNextInfo] = useState(null); // { current_level, next_level, coins_required_next, coins_have, coins_remaining }
  const [currentLevelReq, setCurrentLevelReq] = useState(0);
  // Refer & Earn now opens as full page (/refer)
  // Language modal removed
  const fileInputRef = useRef(null);
  const { isSubscribed, subscribeToPush, error: pushError } = usePushNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user || null;
      setSessionUser(u);
      if (u) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single();
        if (error) throw error;
        setProfile(data);
        // After profile is loaded, prefetch next-level info and current level requirement
        try {
          if (u && data) {
            // RPC to fetch next level info (requires function public.get_next_level_info)
            const { data: nxt, error: nxtErr } = await supabase.rpc('get_next_level_info', { p_user_id: u.id });
            if (!nxtErr && nxt && nxt.length > 0) {
              setNextInfo(nxt[0]);
            } else {
              setNextInfo(null);
            }
            // Fetch current level threshold from levels table (level 0 => req 0)
            const currLv = Math.max(0, Number(data.level || 0));
            if (currLv > 0) {
              const { data: lvlRow, error: lvlErr } = await supabase
                .from('levels')
                .select('coins_required')
                .eq('level', currLv)
                .single();
              if (!lvlErr && lvlRow) setCurrentLevelReq(Number(lvlRow.coins_required || 0));
              else setCurrentLevelReq(0);
            } else {
              setCurrentLevelReq(0);
            }
          }
        } catch {}
        if (data?.avatar_url) {
          if (data.avatar_url.includes('://')) {
            setAvatarUrl(data.avatar_url);
          } else {
            const { data: signed, error: signedError } = await supabase.storage
              .from('avatars')
              .createSignedUrl(data.avatar_url, 60 * 60);
            if (signedError) {
              console.warn('Avatar signed URL creation failed:', signedError);
              setAvatarUrl('');
            } else {
              setAvatarUrl(signed?.signedUrl || '');
            }
          }
        } else {
          setAvatarUrl('');
        }
      } else {
        setProfile(null);
        setAvatarUrl('');
      }
    } catch (e) {
      setProfile(null);
      setAvatarUrl('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => {
    await signOut();
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
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', sessionUser.id);
      if (updErr) throw updErr;
      const { data: signed, error: signedError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(path, 60 * 60);
      if (!signedError) {
        setAvatarUrl(signed?.signedUrl || '');
      }
      await load();
  alert('Avatar updated');
    } catch (err) {
      alert(`Avatar change failed: ${err?.message || 'Try again later'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getLevelRingClass = (lvl) => {
    const n = Number(lvl || 0);
    if (n >= 80) return 'ring-[#8b5cf6]'; // 80+ premium
    if (n >= 50) return 'ring-[#f59e0b]'; // 50+
    if (n >= 20) return 'ring-[#9ca3af]'; // 20+
    return 'ring-[#cd7f32]'; // below 20
  };
  const getLevelProgress = (totalCoins, level) => {
    const have = Number(totalCoins || 0);
    const curr = Math.max(0, Number(level || 0));
    // If already max level (>=100), show full
    if (curr >= 100) return 100;
    const nextReq = Number(nextInfo?.coins_required_next ?? 0);
    const currReq = Number(currentLevelReq || 0);
    if (!nextReq || nextReq <= currReq) return 0;
    const span = nextReq - currReq;
    const pos = Math.max(0, Math.min(span, have - currReq));
    return Math.round((pos / span) * 100);
  };

  

  if (loading) {
    return (
  <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!sessionUser) {
    return (
  <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-800/40 text-indigo-300 flex items-center justify-center mb-3 border border-indigo-700/60">
          <Crown className="w-6 h-6" />
        </div>
        <p className="text-lg text-slate-200">
          You are not logged in or session expired.
          <br />
          Please <Link to="/login" className="text-indigo-300 underline">login</Link> to view your profile.
        </p>
      </div>
    );
  }

  const menuItems = [
    { label: 'About Us', href: '/about-us', icon: Info },
    { label: 'Contact Us', href: '/contact-us', icon: Mail },
    { label: 'Terms & Conditions', href: '/terms-conditions', icon: FileText },
    { label: 'Privacy Policy', href: '/privacy-policy', icon: Shield },
  // Language page removed
  { label: 'Refer & Earn', href: '/refer', icon: Share2 },
  ];

  return (
  <div className="relative overflow-x-hidden">
    <div className="mx-auto w-full px-3 sm:px-4 pt-3 pb-24 max-w-3xl space-y-3 overflow-x-hidden">
        <div className="qd-card relative overflow-hidden rounded-3xl p-4 shadow-2xl">
          <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-tr from-indigo-500/20 via-fuchsia-400/15 to-transparent blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-purple-500/15 via-pink-500/10 to-transparent blur-3xl" />
          <div className="flex flex-col gap-3 relative">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center -ml-2">
                <div className="relative w-[5.5rem] h-[5.5rem]">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-400/20 via-fuchsia-400/20 to-transparent blur-[3px] animate-spin" style={{ animationDuration: '9s' }} />
                  <div className={`relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden flex items-center justify-center text-slate-100 font-bold ring-2 ring-offset-2 ring-offset-slate-900 ${getLevelRingClass(profile?.level)} bg-gradient-to-br from-slate-800 to-slate-700 shadow-md`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
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
                    className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-sm text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
                    title={uploading ? 'Uploading…' : 'Change avatar'}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
                </div>
                <div className="mt-1.5 text-center max-w-[12rem] sm:max-w-none mx-auto">
                  <div className="text-[11px] text-slate-400">Email</div>
                  <div className="text-sm font-medium text-slate-100 truncate">{profile?.email || sessionUser.email}</div>
                </div>
              </div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                  <span>Welcome back</span>
                </div>
                <div className="text-sm font-semibold text-white truncate">{profile?.username ? `@${profile.username}` : 'Username not set'}</div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/20 text-amber-200 border border-amber-500/20">
                    <Coins className="w-3.5 h-3.5" />
                    <span className="font-medium">{Number(profile?.wallet_balance ?? 0).toLocaleString()} Coins</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full">
                <div className="mt-1.5 inline-flex items-center gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setShowLevelInfo((v) => !v)}
                    className="px-2 py-0.5 rounded-full text-[11px] chip-accent-b focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    title="Show next level info"
                    aria-expanded={showLevelInfo}
                  >
                    Level {profile?.level ?? '—'}
                  </button>
                  {showLevelInfo && (
                    <div className="absolute z-20 top-full left-0 mt-2 w-56 rounded-xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-xl p-3">
                      <div className="text-xs font-semibold mb-1">Next Level Info</div>
                      <div className="text-[11px] text-slate-300 space-y-1">
                        <div className="flex justify-between"><span>Current</span><span>{Number(profile?.level || 0)}</span></div>
                        <div className="flex justify-between"><span>Next</span><span>{Math.min(100, Number(profile?.level || 0) + 1)}</span></div>
                        <div className="flex justify-between"><span>Required</span><span>{Number(nextInfo?.coins_required_next || 0).toLocaleString()} coins</span></div>
                        <div className="flex justify-between"><span>You have</span><span>{Number(profile?.total_coins || 0).toLocaleString()} coins</span></div>
                        <div className="flex justify-between"><span>Remaining</span><span>{Number(nextInfo?.coins_remaining || Math.max(0, (Number(nextInfo?.coins_required_next||0) - Number(profile?.total_coins||0)))).toLocaleString()} coins</span></div>
                      </div>
                    </div>
                  )}
                </div>
              <div className="mt-1.5 relative h-2.5 bg-slate-800/70 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-white/10" />
                <div className="relative h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 shadow-[0_0_12px_rgba(99,102,241,0.35)]" style={{ width: `${getLevelProgress(profile?.total_coins, profile?.level)}%` }} />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">{getLevelProgress(profile?.total_coins, profile?.level)}%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">to next level</div>
            </div>
            <div className="pt-2 mt-1 w-full border-t border-gray-100">
              <Button onClick={() => setEditingProfile(true)} size="sm" variant="brand" className="rounded-xl">
                Edit Profile
              </Button>
            </div>
          </div>
        </div>
        

        {/* Push Notifications Section */}
  <div className="qd-card rounded-3xl p-4 shadow-xl text-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-700/50 to-emerald-700/50 text-emerald-200 flex items-center justify-center shadow-sm border border-emerald-500/30">
                <BellRing className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">Push Notifications</h3>
                <p className="text-xs text-slate-400">
                  {isSubscribed ? "You are subscribed to notifications." : "Enable to get alerts for new quizzes."}
                </p>
              </div>
            </div>
            <Button
              onClick={subscribeToPush}
              disabled={isSubscribed}
              size="sm"
              variant="brand"
            >
              {isSubscribed ? "Subscribed" : "Enable"}
            </Button>
          </div>
          {pushError && <p className="text-xs text-rose-300 mt-2">Error: {pushError}</p>}
        </div>

  <div className="qd-card rounded-3xl p-3 shadow-xl">
          <div className="flex flex-col gap-3">
              {menuItems.map((item, idx) => {
              const chipClass = ['chip-accent-d','chip-accent-a','chip-accent-b','chip-accent-c'][idx % 4];
              const content = (
                <div className="group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-indigo-700/60 bg-indigo-900/40 hover:bg-indigo-900/60 transition shadow-sm hover:shadow-lg text-sm text-slate-100 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl ${chipClass} group-hover:scale-[1.03] transition`}>
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold tracking-wide">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" />
                </div>
              );
              return item.href ? (
                <Link key={idx} to={item.href} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded-2xl">
                  {content}
                </Link>
              ) : (
                <button key={idx} onClick={item.onClick} className="text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded-2xl">
                  {content}
                </button>
              );
            })}
          </div>
        </div>

  <div className="qd-card rounded-3xl p-3 shadow-xl">
          <button onClick={handleSignOut} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded-2xl">
            <div className="group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-rose-700/40 bg-rose-900/10 hover:bg-rose-900/20 transition shadow-sm hover:shadow-md text-sm text-rose-300 cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-rose-900/30 text-rose-300 flex items-center justify-center shadow-sm border border-rose-700/40 group-hover:scale-[1.03] transition">
                  <LogOut className="w-4 h-4" />
                </span>
                <span className="font-semibold tracking-wide">Logout</span>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400/70 group-hover:text-rose-300 transition" />
            </div>
          </button>
        </div>

        <ProfileUpdateModal
          isOpen={editingProfile}
          onClose={() => {
            setEditingProfile(false);
            load();
          }}
          isFirstTime={false}
        />

        {/* Language selection removed */}
      </div>
    </div>
  );
}