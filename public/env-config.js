/*
 * Runtime environment overrides for Quiz Dangal.
 * This file is served statically and lets us provide public Supabase keys
 * without relying on build-time env injection (GitHub Pages, etc.).
 *
 * IMPORTANT: only keep public values here. Service-role keys must NEVER live
 * in client bundles or repos.
 */
window.__QUIZ_DANGAL_ENV__ = Object.assign(
  {},
  window.__QUIZ_DANGAL_ENV__ || {},
  {
    VITE_SUPABASE_URL: 'https://gcheopiqayyptfxowulv.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGVvcGlxYXl5cHRmeG93dWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE2MjMsImV4cCI6MjA2OTQzNzYyM30.mVI7HJOEOoMNMRdh6uonCub5G2ggfbGYtIti0x4aAAM',
    // Add your Web Push VAPID public key here (URL-safe base64, no quotes/spaces)
    // Generate with: npx web-push generate-vapid-keys
    VITE_VAPID_PUBLIC_KEY: 'BIgxtFLL3qtXiGpk76YMsPDgcwrxUQV3L5LaIhV2c4IqdEToSlwEHN2eFMTKXsC8CVexXiyjsjh4a5vwarOdO9E'
  }
);
