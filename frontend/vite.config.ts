import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The SPA talks to the backend through same-origin /api paths; the dev
    // server proxies them to the FastAPI app (M8).
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
