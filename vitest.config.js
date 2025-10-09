import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    globals: true,
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'src/__tests__/**',
        'src/main.jsx',
        'dist/**',
        'public/**',
        'scripts/**',
        'supabase/**',
        'vitest.config.*',
        'vite.config.*',
        'tailwind.config.*',
        'postcss.config.*',
        '**/index.html'
      ],
      clean: true
    },
  },
});
