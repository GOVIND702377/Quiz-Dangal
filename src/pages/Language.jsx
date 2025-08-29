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
    <div className="container mx-auto px-4 py-6 max-w-xl">
      <div className="rounded-3xl p-5 bg-white/80 backdrop-blur-xl shadow-xl ring-1 ring-black/5 border border-white/40">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-gray-900">Language</h1>
        </div>
        <p className="text-sm text-gray-600 mb-4">Choose your preferred language for the app. (More languages coming soon)</p>

        <div className="space-y-2">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              onClick={async () => { setValue(lang.code); await save(lang.code); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition ${
                value === lang.code ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{lang.label}</span>
              {value === lang.code ? (
                saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
