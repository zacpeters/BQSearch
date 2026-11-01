import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const configEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export default defineConfig({
  base: configEnv?.VITE_BASE_PATH || '/',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg', 'packs/demo-2026.json', 'packs/season-2027-v1-1.0.0.json', 'analysis/**/*.json', 'releases/season-2027-v1/*.json', 'releases/season-2027-v1/*.txt'], manifest: { name: 'BQ Search', short_name: 'BQ Search', description: 'Offline-first Bible quizzing Scripture search', theme_color: '#f6f7f8', background_color: '#f6f7f8', display: 'standalone', start_url: '.', scope: '.', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] } })]
});
