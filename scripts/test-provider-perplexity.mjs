import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
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

function log(label, status, info = '') {
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : status === 'INFO' ? 'ℹ️' : '❌';
  const msg = info ? ` - ${info}` : '';
  console.log(`${icon} ${label}: ${status}${msg}`);
}

async function testPerplexityKey(name, apiKey) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'quizdangal-provider-test/1.0'
  };
  const body = {
    model: 'sonar',
    messages: [
      { role: 'system', content: 'Respond with JSON only: {"ok":true}' },
      { role: 'user', content: 'test' }
    ],
    max_tokens: 10,
    temperature: 0
  };
  const resp = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const text = await resp.text().catch(() => '');
  const preview = text.slice(0, 200).replace(/\s+/g, ' ').trim();
  return { ok: resp.ok, status: resp.status, preview };
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SERVICE ROLE KEY');
    process.exit(2);
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('ai_providers')
    .select('id,name,enabled,priority,api_key_enc,quota_exhausted')
    .order('priority', { ascending: true });
  if (error) throw error;
  const rows = (data || []).filter(p => p.enabled && /perplexity|pplx|perplexity-ai/i.test(p.name));
  if (!rows.length) {
    log('providers', 'WARN', 'No enabled Perplexity providers found');
    return;
  }
  for (const p of rows) {
    const key = String(p.api_key_enc || '').trim();
    const meta = `len=${key.length}${key.startsWith('pplx-') ? ' pplx-' : ''}${key.startsWith('sk-') ? ' sk-' : ''}`;
    console.log(`\nTesting provider: ${p.name}#${p.id} (priority ${p.priority}) [${meta}]`);
    try {
      const res = await testPerplexityKey(p.name, key);
      if (res.ok) log('perplexity call', 'PASS', `status=${res.status}`);
      else log('perplexity call', 'FAIL', `status=${res.status} body=${res.preview}`);
    } catch (e) {
      log('perplexity call', 'FAIL', e.message);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
