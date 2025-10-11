#!/usr/bin/env node
/**
 * Detect near-duplicate tables by comparing schemas and name similarity.
 * - Parses CREATE TABLE statements from supabase/migrations and supabase/sql
 * - Extracts columns, data types, PKs (best effort with regex)
 * - Flags pairs with high similarity
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_DIRS = [
  path.join(ROOT, 'supabase', 'migrations'),
  path.join(ROOT, 'supabase', 'sql'),
];

const SQL_FILE_RE = /\.sql$/i;

function* walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function readSqlFiles() {
  const files = [];
  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir)) if (SQL_FILE_RE.test(f)) files.push(f);
  }
  return files.sort();
}

function stripComments(sql) {
  const noLine = sql.replace(/--.*$/gm, '');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseCreateTables(sql, file) {
  // naive but works for typical PostgreSQL CREATE TABLE blocks
  // capture content between CREATE TABLE ... ( ... );
  const results = [];
  const regex = /create\s+table\s+(if\s+not\s+exists\s+)?([\w\.\"]+)\s*\(([^;]*?)\)\s*;/gi;
  let m;
  while ((m = regex.exec(sql))) {
    const name = m[2];
    const body = m[3];
    const columns = extractColumns(body);
    const pk = extractPrimaryKey(body);
    results.push({ name, columns, pk, file });
  }
  return results;
}

function extractColumns(body) {
  // split on commas not inside parentheses
  const parts = splitTopLevelCommas(body);
  const cols = [];
  for (const p of parts) {
    const s = p.trim();
    // skip constraints lines
    if (/^(primary|unique|foreign|check)\s+key/i.test(s)) continue;
    // column definition: name type ...
    const m = s.match(/^[\"\w]+\s+[\w\(\)\[\]\.:]+/);
    if (m) {
      const name = s.match(/^[\"\w]+/)[0].replace(/\"/g, '');
      const type = s.replace(/^[\"\w]+\s+/, '').split(/\s+/)[0];
      cols.push({ name: name.toLowerCase(), type: type.toLowerCase() });
    }
  }
  return cols;
}

function extractPrimaryKey(body) {
  const m = body.match(/primary\s+key\s*\(([^\)]+)\)/i);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().replace(/\"/g, '').toLowerCase());
}

function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function nameSimilarity(a, b) {
  // simple Dice coefficient on tokens split by _
  const ta = a.toLowerCase().replace(/\"/g, '').split(/[_\.]/).filter(Boolean);
  const tb = b.toLowerCase().replace(/\"/g, '').split(/[_\.]/).filter(Boolean);
  return jaccard(ta, tb);
}

function analyze(tables) {
  const pairs = [];
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const A = tables[i];
      const B = tables[j];
      const colNamesA = A.columns.map(c => c.name);
      const colNamesB = B.columns.map(c => c.name);
      const jCols = jaccard(colNamesA, colNamesB);
      const jTypes = jaccard(
        A.columns.map(c => `${c.name}:${c.type}`),
        B.columns.map(c => `${c.name}:${c.type}`)
      );
      const nameSim = nameSimilarity(A.name, B.name);
      const pkMatch = JSON.stringify(A.pk) === JSON.stringify(B.pk);

      // Heuristics: both jCols and jTypes high OR name similarity high + jCols moderate
      if ((jCols >= 0.8 && jTypes >= 0.7) || (nameSim >= 0.8 && jCols >= 0.6)) {
        pairs.push({
          a: A,
          b: B,
          scores: { columns: jCols, types: jTypes, name: nameSim, pkMatch },
        });
      }
    }
  }
  return pairs.sort((p, q) => (q.scores.columns + q.scores.types + q.scores.name) - (p.scores.columns + p.scores.types + p.scores.name));
}

function main() {
  const files = readSqlFiles();
  const tables = [];
  for (const f of files) {
    const sql = stripComments(fs.readFileSync(f, 'utf8'));
    const found = parseCreateTables(sql, f);
    tables.push(...found);
  }
  if (tables.length === 0) {
    console.error('No CREATE TABLE found');
    process.exit(2);
  }
  const pairs = analyze(tables);
  console.log(`Checked ${tables.length} tables across ${files.length} files.`);
  if (pairs.length === 0) {
    console.log('No near-duplicate tables detected.');
    return;
  }
  console.log(`Possible near-duplicates: ${pairs.length}`);
  for (const { a, b, scores } of pairs) {
    console.log(`\n- ${a.name}  <=>  ${b.name}`);
    console.log(`  columns=${scores.columns.toFixed(2)}, types=${scores.types.toFixed(2)}, name=${scores.name.toFixed(2)}, pkMatch=${scores.pkMatch}`);
    console.log(`  files:`);
    console.log(`    • ${path.relative(ROOT, a.file)}`);
    console.log(`    • ${path.relative(ROOT, b.file)}`);
    const onlyA = a.columns.map(c=>c.name).filter(x => !new Set(b.columns.map(c=>c.name)).has(x));
    const onlyB = b.columns.map(c=>c.name).filter(x => !new Set(a.columns.map(c=>c.name)).has(x));
    if (onlyA.length) console.log(`  only in ${a.name}: ${onlyA.join(', ')}`);
    if (onlyB.length) console.log(`  only in ${b.name}: ${onlyB.join(', ')}`);
  }
}

main();
