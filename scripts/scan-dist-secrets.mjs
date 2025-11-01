#!/usr/bin/env node
// Simple post-build scanner to catch accidental secret leaks in dist/
// Intentionally narrow patterns to avoid false positives on public values (like anon keys)
// Usage: node ./scripts/scan-dist-secrets.mjs dist

import { promises as fs } from 'fs';
import path from 'path';

const target = process.argv[2] || 'dist';
const root = process.cwd();
const baseDir = path.isAbsolute(target) ? target : path.join(root, target);

/** File extensions we scan as text */
const TEXT_EXTS = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.map', '.txt']);

/** Suspicious patterns to flag (avoid flagging public anon key or generic JWTs) */
const PATTERNS = [
  { name: 'Service role literal', regex: /service[_-]?role/gi },
  { name: 'Supabase service role env', regex: /SUPABASE_SERVICE_ROLE(_KEY)?/g },
  { name: 'Private key block', regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
  { name: 'VAPID private key var', regex: /VAPID_PRIVATE_KEY/gi },
  { name: 'Database URL env', regex: /DATABASE_URL/gi },
];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function shouldScan(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext) || ext === '';
}

/** Allowlist known-safe public files that may contain comments mentioning sensitive terms */
function isAllowed(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  // The public env-config.js contains only public keys and comments warning against service role keys
  // Handle both absolute-like and relative paths on different platforms
  if (rel === 'dist/env-config.js' || rel.endsWith('/dist/env-config.js')) return false; // do not flag this file
  return true;
}

// Intentionally do not strip comments to avoid partial sanitization pitfalls flagged by CodeQL.
// We scan the raw text to ensure multi-character tokens are not incompletely sanitized.

function snippetAround(content, index, len = 60) {
  const start = Math.max(0, index - len);
  const end = Math.min(content.length, index + len);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

async function main() {
  try {
    // Ensure dist exists
    await fs.access(baseDir);
  } catch {
    console.error(`Scan skipped: directory not found: ${baseDir}`);
    process.exit(0);
  }

  const findings = [];

  for await (const file of walk(baseDir)) {
    if (!shouldScan(file)) continue;
    let content;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue; // binary or unreadable
    }
    if (!isAllowed(file)) continue;
    for (const { name, regex } of PATTERNS) {
      // Ensure global flag for exhaustive scanning
      const rx = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');
      const matches = Array.from(content.matchAll(rx));
      for (const m of matches) {
        findings.push({ file, rule: name, snippet: snippetAround(content, m.index ?? 0) });
      }
    }
  }

  if (findings.length) {
    console.error('\nPotential secret(s) found in build output:');
    for (const f of findings) {
      console.error(`- [${f.rule}] ${path.relative(root, f.file)}\n    …${f.snippet}…`);
    }
    console.error('\nFailing to prevent accidental deployment with secrets.');
    process.exit(1);
  } else {
    console.log('✅ No suspicious secrets found in build output.');
  }
}

main().catch((err) => {
  console.error('Scan error:', err);
  process.exit(2);
});
