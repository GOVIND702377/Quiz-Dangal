#!/usr/bin/env node
/**
 * Quick Fixes Script for Quiz Dangal
 * Automatically fixes common code quality issues
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

console.log('🔧 Running Quick Fixes...\n');

let filesFixed = 0;
let issuesFixed = 0;

// Recursively get all JS/JSX files
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build, coverage
      if (!['node_modules', 'dist', 'build', 'coverage', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (['.js', '.jsx'].includes(extname(file))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Fix console.log statements (except in logger.js and test files)
function fixConsoleStatements(content, filePath) {
  let fixed = content;
  let changes = 0;

  // Skip logger.js and test files
  if (filePath.includes('logger.js') || filePath.includes('.test.')) {
    return { content: fixed, changes };
  }

  // Replace console.log with logger.info (if logger is imported)
  if (content.includes("from '@/lib/logger'") || content.includes('from "@/lib/logger"')) {
    const logRegex = /console\.log\(/g;
    const matches = content.match(logRegex);
    if (matches) {
      fixed = fixed.replace(logRegex, 'logger.info(');
      changes += matches.length;
    }
  } else {
    // If logger not imported, comment out console.log
    const logRegex = /(\s*)console\.log\(/g;
    const matches = content.match(logRegex);
    if (matches) {
      fixed = fixed.replace(logRegex, '$1// console.log(');
      changes += matches.length;
    }
  }

  return { content: fixed, changes };
}

// Fix missing semicolons (basic cases)
function fixSemicolons(content) {
  let fixed = content;
  let changes = 0;

  // Add semicolons after variable declarations without them
  const varRegex = /(const|let|var)\s+\w+\s*=\s*[^;]+(?=\n)/g;
  const matches = content.match(varRegex);
  if (matches) {
    fixed = fixed.replace(varRegex, '$&;');
    changes += matches.length;
  }

  return { content: fixed, changes };
}

// Remove trailing whitespace
function removeTrailingWhitespace(content) {
  let fixed = content;
  let changes = 0;

  const lines = content.split('\n');
  const fixedLines = lines.map((line) => {
    const trimmed = line.trimEnd();
    if (trimmed !== line) changes++;
    return trimmed;
  });

  fixed = fixedLines.join('\n');
  return { content: fixed, changes };
}

// Process all files
const srcFiles = getAllFiles('src');

srcFiles.forEach((filePath) => {
  try {
    const originalContent = readFileSync(filePath, 'utf-8');
    let content = originalContent;
    let fileChanges = 0;

    // Apply fixes
    const consoleResult = fixConsoleStatements(content, filePath);
    content = consoleResult.content;
    fileChanges += consoleResult.changes;

    const whitespaceResult = removeTrailingWhitespace(content);
    content = whitespaceResult.content;
    fileChanges += whitespaceResult.changes;

    // Write back if changes were made
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      filesFixed++;
      issuesFixed += fileChanges;
      console.log(`✅ Fixed ${fileChanges} issue(s) in ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`✅ Quick fixes complete!`);
console.log(`   Files modified: ${filesFixed}`);
console.log(`   Issues fixed: ${issuesFixed}`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (filesFixed > 0) {
  console.log('⚠️  Please review the changes and run:');
  console.log('   npm run lint');
  console.log('   npm test');
  console.log('   git diff\n');
}
