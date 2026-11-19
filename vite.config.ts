import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const quizPrecache = env.VITE_ENABLE_QUIZZES === 'true'
    ? {
      strategies: 'injectManifest' as const,
      srcDir: 'pwa',
      filename: 'sw.js',
      injectManifest: { globPatterns: ['**/*.{js,css,html}', 'assets/bqquiz-2027-*.json'] },
    }
    : {};

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), VitePWA({ registerType: 'autoUpdate', ...quizPrecache, includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'packs/season-2027-v1-1.0.0.json', 'analysis/**/*.json', 'releases/season-2027-v1/*.json', 'releases/season-2027-v1/*.txt'], manifest: { name: 'BQ Search', short_name: 'BQ Search', description: 'Offline-first Bible quizzing Scripture search', theme_color: '#f6f7f8', background_color: '#f6f7f8', display: 'standalone', start_url: '.', scope: '.', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] } })]
  };
});
