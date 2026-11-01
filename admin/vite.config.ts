import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',
  base: process.env.VITE_ADMIN_BASE_PATH ?? '/',
  server: { open: '/admin/' },
  plugins: [react()],
  build: {
    outDir: 'admin-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'admin/index.html',
    },
  },
});
