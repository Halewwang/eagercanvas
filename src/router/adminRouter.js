export const createAdminRouteRecords = ({ loadAdminLayout, loadAdminUsers, loadAdminUserDetail } = {}) => [
  { path: '/usage-admin', redirect: '/admin/users' },
  {
    path: '/admin',
    component: loadAdminLayout,
    children: [
      { path: '', redirect: '/admin/users' },
      { path: 'dashboard', redirect: '/admin/users' },
      { path: 'users', name: 'AdminUsers', component: loadAdminUsers, meta: { permission: 'admin.user.read' } },
      { path: 'users/:userId', name: 'AdminUserDetail', component: loadAdminUserDetail, meta: { permission: 'admin.user.read' } },
      { path: ':pathMatch(.*)*', redirect: '/admin/users' }
    ]
  }
]

export const createNavigationGuard = ({
  getAuthStore,
  resolveAdminAccess
} = {}) => async (to) => {
  const protectedPaths = ['/canvas', '/workspace', '/usage', '/admin']
  const requiresAuth = protectedPaths.some((path) => to.path.startsWith(path))
  const requiresBootstrap = to.path === '/login' || requiresAuth
  if (!requiresBootstrap) return true

  const auth = getAuthStore()
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

  if (requiresAuth && !auth.isAuthenticated.value) {
    return {
      path: '/',
      query: { auth: 'login', redirect: to.fullPath }
    }
  }

  if (to.path.startsWith('/admin')) {
    const allowed = await auth.loadAdminSession()
    if (!allowed) return '/'

    const permission = to.matched.map((record) => record.meta.permission).filter(Boolean).at(-1)
    const access = resolveAdminAccess({ permission, permissions: auth.permissions.value })
    if (!access.allowed) return { name: access.routeName }
  }

  return true
}
