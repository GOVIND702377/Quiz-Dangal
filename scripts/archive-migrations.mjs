#!/usr/bin/env node
/**
 * Archive redundant migrations into supabase/migrations_archive/YYYYMMDD.
 * For now, we target older reward-catalog migrations that are superseded
 * by the singularization flow.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');
const ARCHIVE_DIR = path.join(ROOT, 'supabase', 'migrations_archive', yyyymmdd());

const TARGET_PATTERNS = [
  '20251008123000_create_rewards_catalog.sql',
  '20251009105500_rewards_catalog_compat_view.sql',
];

function yyyymmdd() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}${mm}${dd}`;
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function main() {
  ensureDir(ARCHIVE_DIR);
  const moved = [];
  for (const name of TARGET_PATTERNS) {
    const src = path.join(MIG_DIR, name);
    if (fs.existsSync(src)) {
      const dest = path.join(ARCHIVE_DIR, name);
      fs.renameSync(src, dest);
      moved.push({ src: path.relative(ROOT, src), dest: path.relative(ROOT, dest) });
    }
  }
  console.log('Archived files:');
  for (const m of moved) console.log(`- ${m.src} -> ${m.dest}`);
  if (moved.length === 0) console.log('(none matched)');
}

main();
