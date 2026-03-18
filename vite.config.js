import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const manualChunks = (id) => {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('naive-ui')) return 'naive-vendor'
  if (id.includes('@vue-flow')) return 'flow-vendor'
  if (id.includes('vue-router') || id.includes('/vue/')) return 'vue-vendor'

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks
      }
    }
  }
})
