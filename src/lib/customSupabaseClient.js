import { createClient } from '@supabase/supabase-js';

const runtimeEnv = (typeof window !== 'undefined' && window.__QUIZ_DANGAL_ENV__)
  ? window.__QUIZ_DANGAL_ENV__
  : {};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || runtimeEnv.VITE_SUPABASE_URL
  || runtimeEnv.SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || runtimeEnv.VITE_SUPABASE_ANON_KEY
  || runtimeEnv.SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Don't throw on missing envs; create a dummy client only if both exist.
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;