import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// Clean Vite config without any Hostinger/Horizons debug injections
// __dirname is not defined in ESM; derive it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const analyze = process.env.ANALYZE === 'true';

export default defineConfig({
	plugins: [react(), analyze && visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false })].filter(Boolean),
	// Using a custom domain (quizdangal.com) from public/CNAME; site is served at domain root.
	// Base must be '/' so assets resolve correctly under https://quizdangal.com/.
	base: '/',
	server: {
		cors: true,
		host: true,     // Allow both localhost and network access
		port: 5173,     // Default Vite port
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
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
		brotliSize: false,
		sourcemap: false,
		// Keep a simple manualChunks split for major libs to improve cacheability.
		// If you ever see strange React runtime issues, you can remove manualChunks
		// entirely and let Vite/Rollup pick safe defaults automatically.
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types',
			],
			output: {
				manualChunks: {
					react: ['react', 'react-dom'],
					router: ['react-router-dom'],
					motion: ['framer-motion'],
					icons: ['lucide-react'],
					supabase: ['@supabase/supabase-js'],
				},
			},
		},
		chunkSizeWarningLimit: 768,
	},
});
