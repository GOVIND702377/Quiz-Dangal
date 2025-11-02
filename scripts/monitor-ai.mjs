import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const env = {};
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
      if (!m) return;
      const key = m[1].trim();
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith('\'') && val.endsWith('\'')) val = val.slice(1, -1);
      env[key] = val;
    });
    return env;
  } catch {
    return {};
  }
}

function loadEnv() {
  const envLocal = parseEnvFile(path.join(ROOT, '.env.local'));
  const envRoot = parseEnvFile(path.join(ROOT, '.env'));
  return { ...envRoot, ...envLocal, ...process.env };
}

function summarize(items) {
  return items.map(x => `- ${x.created_at} [${x.level}] ${x.message}`).join('\n');
}

async function sendEmailResend(to, subject, text) {
  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) return { ok: false, reason: 'RESEND_API_KEY missing' };
  const from = RESEND_FROM || 'alerts@no-reply.local';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : String(to).split(',').map(s => s.trim()).filter(Boolean), subject, text })
  });
  return { ok: resp.ok, status: resp.status, body: await resp.text().catch(()=> '') };
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const sinceMins = Number(process.env.MONITOR_WINDOW_MIN || 30);
  const since = new Date(Date.now() - sinceMins * 60 * 1000).toISOString();

  let alerts = [];

  // 1) Errors/Warns in logs
  const { data: logs, error: logsErr } = await sb
    .from('ai_generation_logs')
    .select('created_at,level,message')
    .gte('created_at', since)
    .in('level', ['warn','error'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (logsErr) throw logsErr;
  if (logs?.length) {
    alerts.push(`Logs (last ${sinceMins}m):\n${summarize(logs)}`);
  }

  // 2) Failed jobs
  const { data: failed, error: jobsErr } = await sb
    .from('ai_generation_jobs')
    .select('id,category,slot_start,status,error,created_at')
    .eq('status', 'failed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);
  if (jobsErr) throw jobsErr;
  if (failed?.length) {
    const lines = failed.map(j => `- #${j.id} ${j.category} @ ${j.slot_start} -> ${j.error || 'no error'}`).join('\n');
    alerts.push(`Failed jobs (last ${sinceMins}m):\n${lines}`);
  }

  if (!alerts.length) {
    console.log(`No alerts in last ${sinceMins} minutes.`);
    return;
  }

  const subject = `AI Monitor: ${alerts.length} issue group(s)`;
  const text = alerts.join('\n\n');

  const recipients = process.env.ALERT_TO || env.ALERT_TO || '';
  if (!recipients) {
    console.warn('ALERT_TO not configured; printing alert summary instead:\n');
    console.log(text);
    // Exit nonzero so CI can flag
    process.exit(1);
    return;
  }

  const res = await sendEmailResend(recipients, subject, text);
  if (!res.ok) {
    console.error('Email send failed:', res.status, res.body);
    process.exit(1);
  } else {
    console.log('Alert email sent.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
