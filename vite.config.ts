import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://ryangano.github.io/find-me/, so every asset URL needs that prefix.
export default defineConfig({
  base: '/find-me/',
  plugins: [react()],
});
