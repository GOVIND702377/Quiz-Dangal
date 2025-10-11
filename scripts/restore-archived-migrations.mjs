#!/usr/bin/env node
/**
 * Restore migrations from the latest archive folder back into supabase/migrations
 * to keep local migration history aligned with remote.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');
const ARCHIVE_ROOT = path.join(ROOT, 'supabase', 'migrations_archive');

function latestArchiveDir() {
  if (!fs.existsSync(ARCHIVE_ROOT)) return null;
  const entries = fs.readdirSync(ARCHIVE_ROOT).filter(n => /\d{8}/.test(n)).sort();
  if (entries.length === 0) return null;
  return path.join(ARCHIVE_ROOT, entries[entries.length - 1]);
}

function restoreAll(dir) {
  const moved = [];
  for (const name of fs.readdirSync(dir)) {
    const src = path.join(dir, name);
    const dest = path.join(MIG_DIR, name);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.renameSync(src, dest);
      moved.push({ src: path.relative(ROOT, src), dest: path.relative(ROOT, dest) });
    }
  }
  return moved;
}

function main() {
  const dir = latestArchiveDir();
  if (!dir) { console.log('No archive dir found.'); return; }
  const moved = restoreAll(dir);
  console.log('Restored files:');
  for (const m of moved) console.log(`- ${m.src} -> ${m.dest}`);
  if (moved.length === 0) console.log('(none moved)');
}

main();
