import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3009',
        changeOrigin: true
      },
      '/images': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3009',
        changeOrigin: true
      },
      '/socket.io': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3009',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    emptyOutDir: false
  },
  test: {
    environment: 'happy-dom',
    globals: true
  }
})
