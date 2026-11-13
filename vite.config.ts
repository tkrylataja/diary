import react from '@vitejs/plugin-react';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const BASE = '/diary/';

// SPEC §10: мінімальна CSP. Лише в production-білді, бо dev-сервер Vite
// підставляє inline-скрипти для HMR.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/**
 * `npm run dev:demo`: dev-сервер віддає demo/data.enc замість public/data.enc
 * (пароль demo-demo-demo). У білд не потрапляє.
 */
function serveDemoData(): Plugin {
  const file = fileURLToPath(new URL('./demo/data.enc', import.meta.url));
  return {
    name: 'serve-demo-data',
    apply: (_, env) => env.command === 'serve' && env.mode === 'demo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== `${BASE}data.enc`) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Last-Modified', statSync(file).mtime.toUTCString());
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages: https://tkrylataja.github.io/diary/
  base: BASE,
  plugins: [react(), cspMeta(), serveDemoData()],
  build: {
    // Без inline data: для шрифтів та іконок — усе окремими файлами під CSP.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
