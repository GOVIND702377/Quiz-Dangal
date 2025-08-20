#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'dist', 'index.html');
const dest = path.join(process.cwd(), 'dist', '404.html');

try {
  if (!fs.existsSync(src)) {
    console.error('copy-404: dist/index.html not found. Run build first.');
    process.exit(0);
  }
  fs.copyFileSync(src, dest);
  console.log('copy-404: Created dist/404.html for SPA fallback');
} catch (e) {
  console.error('copy-404: Failed to create 404.html:', e);
  process.exit(1);
}
