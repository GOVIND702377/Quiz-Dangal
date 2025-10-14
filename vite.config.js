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
	// Using a custom domain for this project repo; site is served at domain root.
	// Base must be '/' so assets resolve under https://quizdangal.com/.
			// Using custom domain (public/CNAME). Keep base at root.
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
		// Remove manualChunks to avoid circular imports between vendor/react-vendor that can break React at runtime.
		// Vite/Rollup will choose safe defaults.
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
