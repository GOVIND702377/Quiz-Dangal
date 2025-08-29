import path from 'node:path';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Clean Vite config without any Hostinger/Horizons debug injections
export default defineConfig({
	plugins: [react()],
	// Using a custom domain for this project repo; site is served at domain root.
	// Base must be '/' so assets resolve under https://quizdangal.com/.
	base: '/',
	server: {
		cors: true,
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
				'@babel/types'
