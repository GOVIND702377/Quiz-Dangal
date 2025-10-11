#!/usr/bin/env node
/**
 * Scan Supabase SQL (migrations + sql folder) for duplicate object definitions
 * - tables (create table)
 * - views (create view / create materialized view)
 * - functions (create function)
 * - triggers (create trigger)
 * - policies (create policy)
 *
 * It emits a JSON summary and a human-readable table.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_DIRS = [
  path.join(ROOT, 'supabase', 'migrations'),
  path.join(ROOT, 'supabase', 'sql'),
];

const SQL_FILE_RE = /\.sql$/i;

function readAllSqlFiles() {
  const files = [];
  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of walk(dir)) {
      if (SQL_FILE_RE.test(entry)) files.push(entry);
    }
  }
  return files.sort();
}

function* walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function slurp(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalize(sql) {
  // strip comments and compress whitespace for easier regex
  const noLineComments = sql.replace(/--.*$/gm, '');
  const noBlock = noLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.replace(/\s+/g, ' ').trim();
}

function collectDefinitions(files) {
  const defs = {
    tables: new Map(),
    views: new Map(),
    matviews: new Map(),
    functions: new Map(),
    triggers: new Map(),
    policies: new Map(),
  };

  const pushDef = (map, name, file) => {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(file);
  };

  const tableRe = /create\s+table\s+(if\s+not\s+exists\s+)?([\w\.\"]+)/gi;
  const viewRe = /create\s+view\s+(if\s+not\s+exists\s+)?([\w\.\"]+)/gi;
  const matviewRe = /create\s+materialized\s+view\s+(if\s+not\s+exists\s+)?([\w\.\"]+)/gi;
  const funcRe = /create\s+function\s+([\w\.\"]+)/gi;
  const trigRe = /create\s+trigger\s+([\w\-\."]+)/gi;
  const policyRe = /create\s+policy\s+([\w\-\."]+)/gi;

  for (const f of files) {
    const norm = normalize(slurp(f));

    let m;
    while ((m = tableRe.exec(norm))) pushDef(defs.tables, m[2], f);
    while ((m = viewRe.exec(norm))) pushDef(defs.views, m[2], f);
    while ((m = matviewRe.exec(norm))) pushDef(defs.matviews, m[2], f);
    while ((m = funcRe.exec(norm))) pushDef(defs.functions, m[1], f);
    while ((m = trigRe.exec(norm))) pushDef(defs.triggers, m[1], f);
    while ((m = policyRe.exec(norm))) pushDef(defs.policies, m[1], f);
  }

  return defs;
}

function summarize(defs) {
  const toPlain = (map) => {
    const out = [];
    for (const [name, files] of map.entries()) {
      if (files.length > 1) out.push({ name, count: files.length, files });
    }
    return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  return {
    tables: toPlain(defs.tables),
    views: toPlain(defs.views),
    matviews: toPlain(defs.matviews),
    functions: toPlain(defs.functions),
    triggers: toPlain(defs.triggers),
    policies: toPlain(defs.policies),
  };
}

function printReport(summary) {
  const sections = Object.entries(summary);
  for (const [kind, items] of sections) {
    console.log(`\n== ${kind.toUpperCase()} (duplicates: ${items.length}) ==`);
    if (items.length === 0) {
      console.log('  none');
      continue;
    }
    for (const it of items) {
      console.log(`- ${it.name}  [${it.count}]`);
      for (const f of it.files) console.log(`    • ${path.relative(ROOT, f)}`);
    }
  }
}

function main() {
  const files = readAllSqlFiles();
  if (files.length === 0) {
    console.error('No SQL files found under supabase/migrations or supabase/sql');
    process.exit(2);
  }
  const defs = collectDefinitions(files);
  const summary = summarize(defs);
  printReport(summary);
  // Also emit machine-parsable JSON if CI needs it
  if (process.env.JSON) {
    console.log('\n--- JSON ---');
    console.log(JSON.stringify(summary, null, 2));
  }
}

main();
