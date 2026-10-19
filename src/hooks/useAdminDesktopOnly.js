import { onBeforeUnmount, onMounted, ref } from 'vue'

export const ADMIN_DESKTOP_MEDIA_QUERY = '(min-width: 768px)'
export const ADMIN_DESKTOP_ACTIONS_KEY = Symbol('admin-desktop-actions')

const getWindowMatchMedia = () => typeof window === 'undefined' ? null : window.matchMedia?.bind(window)

export const createAdminDesktopOnlyState = ({ matchMedia = getWindowMatchMedia() } = {}) => {
  const isDesktop = ref(false)
  let mediaQuery = null

  const update = (event) => {
    isDesktop.value = Boolean(event?.matches)
  }

  const start = () => {
    if (typeof matchMedia !== 'function') {
      isDesktop.value = false
      return
    }
    mediaQuery = matchMedia(ADMIN_DESKTOP_MEDIA_QUERY)
    update(mediaQuery)
    mediaQuery?.addEventListener?.('change', update)
    if (!mediaQuery?.addEventListener) mediaQuery?.addListener?.(update)
  }

  const stop = () => {
    mediaQuery?.removeEventListener?.('change', update)
    if (!mediaQuery?.removeEventListener) mediaQuery?.removeListener?.(update)
    mediaQuery = null
  }

  return { isDesktop, start, stop }
}

export const useAdminDesktopOnly = (options) => {
  const state = createAdminDesktopOnlyState(options)
  onMounted(state.start)
  onBeforeUnmount(state.stop)
  return state
}

export default useAdminDesktopOnly
