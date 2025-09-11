import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Check, Globe, Loader2 } from 'lucide-react';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
];

export default function Language() {
  const { user, userProfile, loading } = useAuth();
  const [value, setValue] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // load from profile or localStorage
    const saved = userProfile?.language || localStorage.getItem('qd_language') || 'en';
    if (LANGS.find(l => l.code === saved)) setValue(saved);
  }, [userProfile]);

  const save = async (val) => {
    setSaving(true);
    try {
      localStorage.setItem('qd_language', val);
      if (user) {
        await supabase.from('profiles').update({ language: val }).eq('id', user.id);
      }
    } catch {}
    finally { setSaving(false); }
  };

  return (
  <div className="min-h-screen text-slate-100">
      <div className="container mx-auto px-4 py-6 max-w-xl">
        <div className="rounded-3xl p-5 bg-gradient-to-br from-indigo-950/60 via-violet-950/50 to-fuchsia-950/50 backdrop-blur-xl shadow-xl border border-indigo-700/60">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-cyan-300" />
            <h1 className="text-lg font-semibold bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Language</h1>
          </div>
          <p className="text-sm text-slate-300 mb-4">Choose your preferred language for the app. (More languages coming soon)</p>

        <div className="space-y-2">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              onClick={async () => { setValue(lang.code); await save(lang.code); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition ${
                  value === lang.code ? 'bg-cyan-900/30 border-cyan-600/50 text-cyan-100' : 'bg-slate-900/60 border-slate-700/60 text-slate-200 hover:bg-slate-800/60'
                }`}
            >
              <span className="font-medium">{lang.label}</span>
                {value === lang.code ? (
                  saving ? <Loader2 className="w-4 h-4 animate-spin text-cyan-200" /> : <Check className="w-4 h-4 text-cyan-200" />
                ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
