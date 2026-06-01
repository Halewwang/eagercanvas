import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const createBuildInfo = () => {
  const builtAt = new Date().toISOString()
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''
  const shortSha = commitSha ? commitSha.slice(0, 7) : ''
  const stamp = builtAt.replace(/[-:TZ.]/g, '').slice(0, 14)

  return {
    buildId: shortSha ? `${stamp}-${shortSha}` : stamp,
    builtAt
  }
}

const buildInfo = createBuildInfo()

const manualChunks = (id) => {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('naive-ui')) return 'naive-vendor'
  if (id.includes('@vue-flow')) return 'flow-vendor'
  if (id.includes('vue-router') || id.includes('/vue/')) return 'vue-vendor'

  return 'vendor'
}

const appVersionPlugin = () => ({
  name: 'app-version-manifest',
  configureServer(server) {
    server.middlewares.use('/version.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.end(JSON.stringify(buildInfo))
    })
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(buildInfo, null, 2)
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue(), appVersionPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildInfo.buildId),
    __APP_BUILD_TIME__: JSON.stringify(buildInfo.builtAt),
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },
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
    minify: 'terser',
    modulePreload: {
      polyfill: false
    },
    terserOptions: {
      module: true,
      compress: {
        passes: 3,
        pure_funcs: ['console.debug']
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        hoistTransitiveImports: false,
        manualChunks
      }
    }
  }
})
