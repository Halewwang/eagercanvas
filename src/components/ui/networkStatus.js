export const getNavigatorOnlineState = (navigatorRef = globalThis.navigator) => (
  !navigatorRef || navigatorRef.onLine !== false
)

export const bindNetworkStatusListeners = ({
  isOnline,
  navigatorRef = globalThis.navigator,
  syncOfflineDrafts,
  windowRef = globalThis.window
} = {}) => {
  const markOnline = () => {
    isOnline.value = true
    void syncOfflineDrafts?.()
  }
  const markOffline = () => {
    isOnline.value = false
  }

  isOnline.value = getNavigatorOnlineState(navigatorRef)

  if (!windowRef) return () => {}

  windowRef.addEventListener('online', markOnline)
  windowRef.addEventListener('offline', markOffline)

  return () => {
    windowRef.removeEventListener('online', markOnline)
    windowRef.removeEventListener('offline', markOffline)
  }
}
