import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/market-data': {
        target: 'https://test.neuix.host',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});