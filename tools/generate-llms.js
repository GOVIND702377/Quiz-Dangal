#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

function extractRoutes(appJsxPath) {
  if (!fs.existsSync(appJsxPath)) return new Map();

  try {
    const content = fs.readFileSync(appJsxPath, 'utf8');
    const routes = new Map();
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });

    traverse(ast, {
      JSXOpeningElement(path) {
        if (path.node.name.name === 'Route') {
          let routePath = '/';
          let componentName = '';

          const isIndex = path.node.attributes.some(
            (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'index'
          );

          const pathAttribute = path.node.attributes.find(
            (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'path'
          );

          if (pathAttribute) {
            routePath = pathAttribute.value.value;
            if (!routePath.startsWith('/')) {
              routePath = `/${routePath}`;
            }
          }

          const elementAttribute = path.node.attributes.find(
            (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'element'
          );

          if (
            elementAttribute &&
            elementAttribute.value &&
            elementAttribute.value.type === 'JSXExpressionContainer'
          ) {
            const element = elementAttribute.value.expression;
            if (element.type === 'JSXElement') {
              componentName = element.openingElement.name.name;
            }
          }

          if (componentName) {
            routes.set(componentName, isIndex ? '/' : routePath);
          }
        }
      }
    });

    return routes;
  } catch (error) {
    console.error(`Error parsing routes from ${appJsxPath}:`, error);
    return new Map();
  }
}

function findReactFiles(dir) {
  return fs.readdirSync(dir).map(item => path.join(dir, item));
}

function extractHelmetData(content, filePath, routes) {
  let title = 'Untitled Page';
  let description = 'No description available';

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });

    traverse(ast, {
      JSXOpeningElement(path) {
        if (path.node.name.name === 'Helmet') {
          path.parent.children.forEach(child => {
            if (child.type === 'JSXElement' && child.openingElement.name.name === 'title') {
              child.children.forEach(titleChild => {
                if (titleChild.type === 'JSXText') {
                  title = titleChild.value.trim();
                }
              });
            } else if (child.type === 'JSXElement' && child.openingElement.name.name === 'meta') {
              const nameAttribute = child.openingElement.attributes.find(attr => attr.name.name === 'name');
              const contentAttribute = child.openingElement.attributes.find(attr => attr.name.name === 'content');
              if (nameAttribute && nameAttribute.value.value === 'description' && contentAttribute) {
                description = contentAttribute.value.value;
              }
            }
          });
        }
      }
    });
  } catch (error) {
    console.error(`Error parsing helmet data from ${filePath}:`, error);
  }

  const fileName = path.basename(filePath, path.extname(filePath));
  const url = routes.length && routes.has(fileName) 
    ? routes.get(fileName) 
    : generateFallbackUrl(fileName);
  
  return {
    url,
    title,
    description
  };
}

function generateFallbackUrl(fileName) {
  const cleanName = fileName.replace(/Page$/, '').toLowerCase();
  return cleanName === 'app' ? '/' : `/${cleanName}`;
}

function generateLlmsTxt(pages) {
  const sortedPages = pages.sort((a, b) => a.title.localeCompare(b.title));
  const pageEntries = sortedPages.map(page => 
    `- [${page.title}](${page.url}): ${page.description}`
  ).join('\n');
  
  return `## Pages\n${pageEntries}`;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function processPageFile(filePath, routes) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return extractHelmetData(content, filePath, routes);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return null;
  }
}

function main() {
  const pagesDir = path.join(process.cwd(), 'src', 'pages');
  const appJsxPath = path.join(process.cwd(), 'src', 'App.jsx');

  let pages = [];
  
  if (!fs.existsSync(pagesDir)) {
    pages.push(processPageFile(appJsxPath, []));
  } else {
    const routes = extractRoutes(appJsxPath);
    const reactFiles = findReactFiles(pagesDir);

    pages = reactFiles
      .map(filePath => processPageFile(filePath, routes))
      .filter(Boolean);
    
    if (pages.length === 0) {
      console.error('❌ No pages with Helmet components found!');
      process.exit(1);
    }
  }


  const llmsTxtContent = generateLlmsTxt(pages);
  const outputPath = path.join(process.cwd(), 'public', 'llms.txt');
  
  ensureDirectoryExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, llmsTxtContent, 'utf8');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main();
}
