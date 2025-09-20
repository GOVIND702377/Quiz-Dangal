import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Clean Vite config without any Hostinger/Horizons debug injections
// __dirname is not defined in ESM; derive it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react()],
	// Using a custom domain for this project repo; site is served at domain root.
	// Base must be '/' so assets resolve under https://quizdangal.com/.
	base: '/',
	server: {
		cors: true,
		host: true,     // Allow both localhost and network access
		port: 5173,     // Default Vite port
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
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
		},
	},
});
