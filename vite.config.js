import react from '@vitejs/plugin-react'

export default {
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }

          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) {
            return 'vendor-router'
          }

          if (id.includes('/framer-motion/')) {
            return 'vendor-motion'
          }

          if (id.includes('/lucide-react/')) {
            return 'vendor-icons'
          }

          if (id.includes('/@ffmpeg/')) {
            return 'vendor-ffmpeg'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
}
