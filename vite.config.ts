import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const configEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export default defineConfig({
  base: configEnv?.VITE_BASE_PATH || '/',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'packs/season-2027-v1-1.0.0.json', 'analysis/**/*.json', 'releases/season-2027-v1/*.json', 'releases/season-2027-v1/*.txt'], manifest: { name: 'BQ Search', short_name: 'BQ Search', description: 'Offline-first Bible quizzing Scripture search', theme_color: '#f6f7f8', background_color: '#f6f7f8', display: 'standalone', start_url: '.', scope: '.', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] } })]
});
