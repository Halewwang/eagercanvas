/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resolveAdminRouteAccess } from '@/utils/adminNavigation'
import { createAdminRouteRecords, createNavigationGuard } from './adminRouter.js'
import { loadCanvasView } from './viewLoaders.js'

const adminRouteRecords = createAdminRouteRecords({
  loadAdminLayout: () => import('@/layouts/AdminLayout.vue'),
  loadAdminUsers: () => import('@/views/AdminUsers.vue'),
  loadAdminUserDetail: () => import('@/views/AdminUserDetail.vue')
})

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
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/canvas/:id?',
    name: 'Canvas',
    component: loadCanvasView
  },
  {
    path: '/workspace',
    name: 'Workspace',
    component: () => import('@/views/Workspace.vue')
  },
  {
    path: '/workspace/join/:token',
    name: 'WorkspaceJoin',
    component: () => import('@/views/Workspace.vue')
  },
  {
    path: '/usage',
    name: 'Usage',
    component: () => import('@/views/Usage.vue')
  },
  ...adminRouteRecords
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(createNavigationGuard({
  getAuthStore: useAuthStore,
  resolveAdminAccess: resolveAdminRouteAccess
}))

router.afterEach((to) => {
  const isDashboard = to.path.startsWith('/admin')
  document.title = isDashboard ? 'Aion Dashboard' : 'Aion Craft｜Canvas'
})

export default router
