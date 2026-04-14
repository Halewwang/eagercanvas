const DB_NAME = 'ai-canvas-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'
const LEGACY_CANVAS_PREFIX = 'ai-canvas-project-canvas-draft'

const defaultCanvasData = {
  nodes: [],
  edges: [],
  groups: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

export const normalizeCanvasDraftRecord = (value = {}) => {
  if (!value || typeof value !== 'object') return null
  const rawCanvas = Object.prototype.hasOwnProperty.call(value, 'canvasData')
    ? value.canvasData
    : (
        Object.prototype.hasOwnProperty.call(value, 'nodes')
        || Object.prototype.hasOwnProperty.call(value, 'edges')
        || Object.prototype.hasOwnProperty.call(value, 'viewport')
          ? value
          : null
      )
  if (!rawCanvas || typeof rawCanvas !== 'object') return null

  const draftUpdatedAt = String(value.draftUpdatedAt || value.updatedAt || '').trim() || new Date().toISOString()
  const baseRevision = String(value.baseRevision || value.baseVersion || value.serverUpdatedAt || '').trim() || null
  const remoteSynced = value.remoteSynced === true
  return {
    version: 3,
    canvasData: {
      ...clone(defaultCanvasData),
      ...clone(rawCanvas),
      viewport: {
        ...defaultCanvasData.viewport,
        ...(rawCanvas.viewport && typeof rawCanvas.viewport === 'object' ? clone(rawCanvas.viewport) : {})
      }
    },
    draftUpdatedAt,
    baseRevision,
    remoteSynced,
    status: value.status || (remoteSynced ? 'synced' : 'localPersisted')
  }
}

export const createMemoryDraftDriver = () => {
  const records = new Map()
  return {
    async get(key) {
      return records.has(key) ? clone(records.get(key)) : null
    },
    async set(record) {
      records.set(record.key, clone(record))
      return true
    },
    async delete(key) {
      records.delete(key)
    },
    async list(prefix = '') {
      return Array.from(records.values())
        .filter((record) => !prefix || String(record.key).startsWith(prefix))
        .map(clone)
    }
  }
}

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error)
  transaction.onabort = () => reject(transaction.error)
})

export const createIndexedDBDraftDriver = ({ indexedDBRef = globalThis.indexedDB } = {}) => {
  let dbPromise = null
  const open = () => {
    if (!indexedDBRef) return Promise.reject(new Error('IndexedDB is not available'))
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDBRef.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return dbPromise
  }

  return {
    async get(key) {
      const db = await open()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const value = await requestToPromise(tx.objectStore(STORE_NAME).get(key))
      await transactionDone(tx)
      return value || null
    },
    async set(record) {
      const db = await open()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      await transactionDone(tx)
      return true
    },
    async delete(key) {
      const db = await open()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      await transactionDone(tx)
    },
    async list(prefix = '') {
      const db = await open()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const values = await requestToPromise(tx.objectStore(STORE_NAME).getAll())
      await transactionDone(tx)
      return (values || []).filter((record) => !prefix || String(record.key || '').startsWith(prefix))
    }
  }
}

export const createCanvasDraftStorage = ({
  driver = createIndexedDBDraftDriver(),
  userId = '',
  localStorage = typeof window !== 'undefined' ? window.localStorage : null
} = {}) => {
  const cache = new Map()
  const scope = String(userId || '').trim()
  const prefix = `${scope}:`
  const toKey = (projectId) => `${scope}:${projectId}`
  const fromLegacyKey = (key) => {
    const expected = `${LEGACY_CANVAS_PREFIX}:${scope}:`
    if (!scope || !String(key || '').startsWith(expected)) return ''
    return String(key).slice(expected.length)
  }

  const loadDraft = async (projectId) => {
    if (!scope || !projectId) return null
    const raw = await driver.get(toKey(projectId))
    const record = raw ? normalizeCanvasDraftRecord(raw) : null
    if (record) cache.set(String(projectId), record)
    return record
  }

  const saveDraft = async (projectId, input = {}) => {
    if (!scope || !projectId) return false
    const record = normalizeCanvasDraftRecord(input)
    if (!record) return false
    const next = {
      ...record,
      key: toKey(projectId),
      userId: scope,
      projectId: String(projectId)
    }
    await driver.set(next)
    cache.set(String(projectId), record)
    return true
  }

  const hydrate = async () => {
    if (!scope) return []
    const records = await driver.list(prefix)
    cache.clear()
    records.forEach((raw) => {
      const record = normalizeCanvasDraftRecord(raw)
      if (raw?.projectId && record) cache.set(String(raw.projectId), record)
    })
    return Array.from(cache.values())
  }

  const migrateLegacyLocalStorageDrafts = async () => {
    if (!scope || !localStorage) return 0
    const keys = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (fromLegacyKey(key)) keys.push(key)
    }

    let migrated = 0
    for (const key of keys) {
      const projectId = fromLegacyKey(key)
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null')
        const record = normalizeCanvasDraftRecord(parsed)
        if (record) {
          await saveDraft(projectId, record)
          migrated += 1
        }
        localStorage.removeItem(key)
      } catch {
        localStorage.removeItem(key)
      }
    }
    return migrated
  }

  return {
    saveDraft,
    loadDraft,
    hydrate,
    async deleteDraft(projectId) {
      if (!scope || !projectId) return
      cache.delete(String(projectId))
      await driver.delete(toKey(projectId))
    },
    getCachedDraft(projectId) {
      return cache.has(String(projectId)) ? clone(cache.get(String(projectId))) : null
    },
    migrateLegacyLocalStorageDrafts
  }
}

const storageByUser = new Map()

export const getCanvasDraftStorage = (userId = '') => {
  const key = String(userId || '').trim()
  if (!storageByUser.has(key)) {
    storageByUser.set(key, createCanvasDraftStorage({ userId: key }))
  }
  return storageByUser.get(key)
}
