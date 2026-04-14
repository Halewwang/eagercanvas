const DEFAULT_CHANNEL_NAME = 'ai-canvas-sync'

export const createMemoryBroadcastBus = () => {
  const listeners = new Set()
  return {
    postMessage(message) {
      listeners.forEach((listener) => listener({ data: message }))
    },
    addEventListener(event, listener) {
      if (event === 'message') listeners.add(listener)
    },
    removeEventListener(event, listener) {
      if (event === 'message') listeners.delete(listener)
    },
    close() {
      listeners.clear()
    }
  }
}

const createBrowserBus = (channelName) => {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(channelName)
}

const createTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const sanitizeDraftMessage = (message = {}) => ({
  type: message.type,
  projectId: String(message.projectId || ''),
  draftUpdatedAt: message.draftUpdatedAt || new Date().toISOString(),
  baseRevision: message.baseRevision || null,
  status: message.status || 'localPersisted',
  remoteSynced: message.remoteSynced === true,
  sourceTabId: message.sourceTabId
})

export const createCanvasBroadcastCoordinator = ({
  bus = createBrowserBus(DEFAULT_CHANNEL_NAME),
  tabId = createTabId()
} = {}) => {
  const listeners = new Set()

  const handleMessage = (event) => {
    const message = event?.data || {}
    if (!message || message.sourceTabId === tabId) return
    listeners.forEach((listener) => listener(message))
  }

  bus?.addEventListener?.('message', handleMessage)

  return {
    tabId,
    publishDraftSaved(input = {}) {
      if (!bus || !input.projectId) return
      bus.postMessage(sanitizeDraftMessage({
        ...input,
        type: 'draft-saved',
        sourceTabId: tabId
      }))
    },
    publishRemoteSynced(input = {}) {
      if (!bus || !input.projectId) return
      bus.postMessage(sanitizeDraftMessage({
        ...input,
        type: 'remote-synced',
        status: 'synced',
        remoteSynced: true,
        sourceTabId: tabId
      }))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      bus?.removeEventListener?.('message', handleMessage)
      bus?.close?.()
      listeners.clear()
    }
  }
}

export const canvasBroadcast = createCanvasBroadcastCoordinator()
