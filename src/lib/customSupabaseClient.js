import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gcheopiqayyptfxowulv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGVvcGlxYXl5cHRmeG93dWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE2MjMsImV4cCI6MjA2OTQzNzYyM30.mVI7HJOEOoMNMRdh6uonCub5G2ggfbGYtIti0x4aAAM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);