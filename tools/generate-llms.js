#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import pkg from '@babel/traverse';
const { traverse } = pkg;

try {
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

      return { title, description };
    } catch (error) {
      console.error(`Error parsing helmet data from ${filePath}:`, error);
      return { title, description };
    }
  }

  function generateFallbackUrl(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));
    return `/${baseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  function generateLlmsTxt(pages) {
    const llmsContent = pages.map(page => {
      const url = page.route || generateFallbackUrl(page.file);
      return `${url}\t${page.title}\t${page.description}`;
    }).join('\n');

    return llmsContent;
  }

  function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  function processPageFile(filePath, routes) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const { title, description } = extractHelmetData(content, filePath, routes);
      const fileName = path.basename(filePath);
      const route = routes.get(fileName.replace('.jsx', '')) || generateFallbackUrl(fileName);
      
      return {
        file: fileName,
        title,
        description,
        route
      };
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      return null;
    }
  }

  function main() {
    const appJsxPath = path.join(process.cwd(), 'src', 'App.jsx');
    const pagesDir = path.join(process.cwd(), 'src', 'pages');
    const publicDir = path.join(process.cwd(), 'public');
    const distDir = path.join(process.cwd(), 'dist');

    try {
      const routes = extractRoutes(appJsxPath);
      const pageFiles = fs.readdirSync(pagesDir)
        .filter(file => file.endsWith('.jsx'))
        .map(file => path.join(pagesDir, file));

      const pages = pageFiles
        .map(filePath => processPageFile(filePath, routes))
        .filter(page => page !== null);

      if (pages.length === 0) {
        console.error('❌ No pages with Helmet components found!');
        return;
      }

      const llmsContent = generateLlmsTxt(pages);
      
      // Write to public directory
      ensureDirectoryExists(publicDir);
      fs.writeFileSync(path.join(publicDir, 'llms.txt'), llmsContent);
      
      // Write to dist directory if it exists
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'llms.txt'), llmsContent);
      }

      console.log(`✅ Generated llms.txt with ${pages.length} pages`);
    } catch (error) {
      console.error('❌ Error in main:', error.message);
    }
  }

  main();
} catch (error) {
  console.error('❌ Fatal error in generate-llms.js:', error.message);
  process.exit(0); // Exit gracefully without error
}
