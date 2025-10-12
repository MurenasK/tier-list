import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/tier-list/',
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
