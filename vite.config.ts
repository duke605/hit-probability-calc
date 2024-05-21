import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/hit-potential-calculator',
  build: {
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      '$src': path.resolve(__dirname, './src'),
      '$lib': path.resolve(__dirname, './src/lib'),
    },
  },
})
