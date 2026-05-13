import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// Vite config for GitHub Pages deployment
// __dirname is not defined in ESM; derive it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const analyze = process.env.ANALYZE === 'true';

export default defineConfig({
	define: {
		__BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
	},
	plugins: [
		react(),
		analyze ? visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false }) : null,
	].filter(Boolean),
	// Using a custom domain (quizdangal.com) from public/CNAME; site is served at domain root.
	// Base must be '/' so assets resolve correctly under https://quizdangal.com/.
	base: '/',
	server: {
		cors: true,
		host: true,     // Allow both localhost and network access
		port: 5173,     // Default Vite port
		headers: {
			// Google Ads iframes don't support COEP, so we disable it
			// GitHub Pages ignores public/_headers, so production relies on HTML/meta-compatible hardening only
			'Cross-Origin-Embedder-Policy': 'unsafe-none',
			'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
		},
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		minify: 'esbuild',
		target: 'es2018',
		cssTarget: 'es2018',
		reportCompressedSize: false,
		sourcemap: false,
		chunkSizeWarningLimit: 768,
	},
});
