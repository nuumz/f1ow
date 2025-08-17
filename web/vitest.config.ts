/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Avoid worker threads; use forks to bypass NODE_OPTIONS restrictions in Worker
    pool: 'forks',
    setupFiles: ['./src/test-setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.stories.{js,ts,jsx,tsx}',
        'dist/',
        'build/',
        '.nuxt/',
        'coverage/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});