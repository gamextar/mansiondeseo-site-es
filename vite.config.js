import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
cd "/Users/javierasenjofuchs/LOCAL DEV/UNICOAPPS.COM/unicoapps-site" && npx wrangler pages deploy . --project-name=unicoapps-site