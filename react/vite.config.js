import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/static/',
  plugins: [react()],
  server: {
    proxy: {
      '/plat': 'http://127.0.0.1:8000',
    },
  },
})
