import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'], setupFiles: ['test/setup.ts'], globals: true },
});
