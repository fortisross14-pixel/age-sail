/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site under /<repo>/
const base = process.env.GITHUB_PAGES ? '/age-sail/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,json}'], maximumFileSizeToCacheInBytes: 6_000_000 },
      manifest: {
        name: 'Age of Sail',
        short_name: 'Age of Sail',
        description: 'Chart the unknown, trade across the ocean, and build a crown’s fortune.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#efe2c4',
        theme_color: '#5c3c20',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
