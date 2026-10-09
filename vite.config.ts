/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const nodeSqlitePlugin = () => ({
  name: 'node-sqlite-external',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id === 'node:sqlite' || id === 'sqlite') {
      return '\0node:sqlite';
    }
  },
  load(id: string) {
    if (id === '\0node:sqlite') {
      return `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const sqlite = require('node:sqlite');
        export const { DatabaseSync, StatementSync, Session, backup, constants } = sqlite;
        export default sqlite;
      `;
    }
  },
});

export default (defineConfig as any)({
  plugins: [react(), nodeSqlitePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  ssr: {
    external: ['node:sqlite'],
  },
  test: {
    fileParallelism: false,
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.ts'],
    server: {
      deps: {
        external: ['node:sqlite'],
      },
    },
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
    ],
    testTimeout: 10000,
  },
});
