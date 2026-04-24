import { reactive } from 'vue'

const DEFAULT_DURATION = 2600

export const toastState = reactive({
  items: []
})

let nextToastId = 1

const levelToConsole = {
  success: console.info,
  warning: console.warn,
  error: console.error,
  info: console.info
}

const pushToast = (type, message, duration = DEFAULT_DURATION) => {
  const id = nextToastId++

  toastState.items.push({
    id,
    type,
    message
  })

  if (import.meta.env.DEV) {
    levelToConsole[type]?.(`[Notifier ${type}]`, message)
  }

  if (duration > 0) {
    window.setTimeout(() => {
      dismissToast(id)
    }, duration)
  }

  return id
}

export const dismissToast = (id) => {
  const index = toastState.items.findIndex((item) => item.id === id)
  if (index >= 0) {
    toastState.items.splice(index, 1)
  }
}

export const notifier = {
  success: (message, duration) => pushToast('success', message, duration),
  warning: (message, duration) => pushToast('warning', message, duration),
  error: (message, duration) => pushToast('error', message, duration),
  info: (message, duration) => pushToast('info', message, duration)
}

export default notifier
