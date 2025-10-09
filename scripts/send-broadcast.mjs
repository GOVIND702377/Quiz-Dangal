#!/usr/bin/env node
// Simple helper to send a push via Edge Function in cron mode (no browser/CORS)
// Usage:
//   node scripts/send-broadcast.mjs "Title" "Message" [segment] [type] [url]
// Examples:
//   node scripts/send-broadcast.mjs "Test" "Hello everyone"             # broadcast to all
//   node scripts/send-broadcast.mjs "Start Soon" "1 min to go" "participants:QUIZ_UUID" start_soon

import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL in env');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('Missing CRON_SECRET in env');
  process.exit(1);
}
if (!ANON) {
  console.error('Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in env');
  process.exit(1);
}

const [,, title, message, segment = 'all', type, url] = process.argv;
if (!title || !message) {
  console.error('Usage: node scripts/send-broadcast.mjs "Title" "Message" [segment] [type] [url]');
  process.exit(1);
}

const body = {
  title,
  message,
  ...(segment && segment !== 'all' ? { segment } : {}),
  ...(type ? { type } : {}),
  ...(url ? { url } : {}),
  mode: 'cron',
};

const endpoint = `${SUPABASE_URL}/functions/v1/send-notifications`;
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Cron-Secret': CRON_SECRET,
    'Authorization': `Bearer ${ANON}`,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error('Error:', res.status, text);
  process.exit(1);
}
console.log('OK:', text);
