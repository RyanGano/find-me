import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://findme.ryangano.com/, so assets are rooted at /.
export default defineConfig({
  base: '/',
  plugins: [react()],
});
