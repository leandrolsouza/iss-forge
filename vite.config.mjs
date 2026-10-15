import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { rendererCsp } from './electron/contentSecurity.mjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
let development = false;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'renderer-csp',
      configResolved(config) {
        development = config.command === 'serve';
      },
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: rendererCsp(development) },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
  test: {
    // Cache transforms across runs for faster test execution (Vitest v5+)
    fsModuleCache: true,
  },
});
