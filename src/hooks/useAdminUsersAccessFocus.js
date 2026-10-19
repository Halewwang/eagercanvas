import { computed, onUnmounted, unref, watch } from 'vue'
import { resolveAdminUsersAccessFocus } from './adminAccessNavigation.js'

export const createAdminUsersAccessFocusController = ({
  routeQuery,
  routerReplace = () => {},
  loadUsers = async () => {}
} = {}) => {
  const accessFocus = computed(() => resolveAdminUsersAccessFocus(unref(routeQuery) || {}))
  const loadUsersForCurrentView = () => accessFocus.value ? Promise.resolve(null) : loadUsers()
  const closeAccessFocus = () => routerReplace({ name: 'AdminUsers' })
  const stop = watch(accessFocus, (focus, previousFocus) => {
    if (!focus && previousFocus) void loadUsers()
  })

  return { accessFocus, closeAccessFocus, loadUsersForCurrentView, stop }
}

export const useAdminUsersAccessFocus = (dependencies) => {
  const controller = createAdminUsersAccessFocusController(dependencies)
  onUnmounted(controller.stop)
  return controller
}

export default useAdminUsersAccessFocus
