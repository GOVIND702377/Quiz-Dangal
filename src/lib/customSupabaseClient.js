import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wgaunhqkundxxfjguoin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYXVuaHFrdW5keHhmamd1b2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzQ0NDYsImV4cCI6MjA2ODg1MDQ0Nn0.C5hKQQbm1fDw8mVgQaFvZz5Ok6rrpA1Jmkau7gkuJJU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// customSupabaseClient.js me yeh code add karein:
supabase
  .from('profiles')
  .select('*')
  .limit(1)
  .then(res => console.log('TEST profiles fetch:', res))
  .catch(err => console.error('TEST profiles error:', err));