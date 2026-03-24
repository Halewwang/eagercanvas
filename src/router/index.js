/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    redirect: (to) => ({
      path: '/',
      query: {
        auth: to.query.mode === 'register' ? 'register' : 'login'
      }
    })
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/canvas/:id?',
    name: 'Canvas',
    component: () => import('../views/Canvas.vue')
  },
  {
    path: '/workspace',
    name: 'Workspace',
    component: () => import('../views/Workspace.vue')
  },
  {
    path: '/usage',
    name: 'Usage',
    component: () => import('../views/Usage.vue')
  },
  {
    path: '/usage-admin',
    name: 'UsageAdmin',
    component: () => import('../views/UsageAdmin.vue')
  },
  {
    path: '/admin',
    redirect: '/admin/dashboard'
  },
  {
    path: '/admin/dashboard',
    name: 'AdminDashboard',
    component: () => import('../views/AdminUsers.vue')
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('../views/AdminUsers.vue')
  },
  {
    path: '/admin/service',
    name: 'AdminService',
    component: () => import('../views/AdminUsers.vue')
  },
  {
    path: '/admin/audit',
    name: 'AdminAudit',
    component: () => import('../views/AdminUsers.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  const bypassAuthInDev = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'
  if (bypassAuthInDev) {
    return true
  }

  const auth = useAuthStore()
  await auth.bootstrapAuth()

  if (to.path === '/login') {
    if (auth.isAuthenticated.value) return '/'
    return {
      path: '/',
      query: {
        auth: to.query.mode === 'register' ? 'register' : 'login',
        ...(typeof to.query.redirect === 'string' && to.query.redirect ? { redirect: to.query.redirect } : {})
      }
    }
  }

  const protectedPaths = ['/canvas', '/workspace', '/usage', '/admin']
  const isUsageAdmin = to.path.startsWith('/usage-admin')
  if (isUsageAdmin) {
    return true
  }
  const requiresAuth = protectedPaths.some((path) => to.path.startsWith(path))

  if (requiresAuth && !auth.isAuthenticated.value) {
    return {
      path: '/',
      query: {
        auth: 'login',
        redirect: to.fullPath
      }
    }
  }

  if (to.path.startsWith('/admin')) {
    const allowed = await auth.loadAdminSession()
    if (!allowed) {
      return '/'
    }
  }
})

export default router
