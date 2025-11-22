import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const QUIZ_ID = process.argv[2];
if (!QUIZ_ID) {
  console.error('Usage: node scripts/debug-fetch-quiz.mjs <quiz_id>');
  process.exit(1);
}

const ROOT = process.cwd();
function parseEnvFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((a,l)=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/i); if(!m) return a; const k=m[1].trim(); let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); a[k]=v; return a; }, {});} catch { return {}; }
}
const envLocal = parseEnvFile(path.join(ROOT,'.env.local'));
const url = process.env.SUPABASE_URL || envLocal.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) { console.error('Missing SUPABASE_URL or service role key'); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const hasDev = (s)=>(/[\p{Script=Devanagari}]/u.test(String(s||'')));

const { data: qs, error } = await supabase.from('questions').select('id, question_text, options:options(id, option_text, is_correct)').eq('quiz_id', QUIZ_ID).limit(12);
if (error) { console.error(error); process.exit(3); }
for (const q of qs || []) {
  console.log('\nQ:', q.question_text);
  console.log('   hasHindi=', hasDev(q.question_text));
  for (const o of q.options || []) {
    console.log('  -', o.option_text, '| hasHindi=', hasDev(o.option_text), '| correct=', o.is_correct);
  }
}
