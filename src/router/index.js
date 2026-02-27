/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
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
    path: '/usage',
    name: 'Usage',
    component: () => import('../views/Usage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.bootstrapAuth()

  if (to.path === '/login' && auth.isAuthenticated.value) {
    return '/'
  }

  const protectedPaths = ['/canvas', '/usage']
  const requiresAuth = protectedPaths.some((path) => to.path.startsWith(path))

  if (requiresAuth && !auth.isAuthenticated.value) {
    return '/login'
  }
})

export default router
