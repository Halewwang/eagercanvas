const COLLECTION_NAMES = ['nodes', 'edges', 'groups']
const PATCH_TYPES = new Set(['add', 'remove', 'update', 'move', 'transaction', 'noop'])

const defaultClone = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const isEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const createEmptyState = () => ({
  nodes: [],
  edges: [],
  groups: []
})

export const createCanvasHistoryState = ({ nodes = [], edges = [], groups = [] }, clone = defaultClone) => ({
  nodes: clone(nodes),
  edges: clone(edges),
  groups: clone(groups)
})

const createSnapshotEntry = (state, clone = defaultClone) => ({
  type: 'snapshot',
  payload: createCanvasHistoryState(state || createEmptyState(), clone)
})

const isHistoryEntry = (entry) => !!entry?.type
const isLegacySnapshot = (entry) =>
  !isHistoryEntry(entry) && Array.isArray(entry?.nodes) && Array.isArray(entry?.edges)
const isPatchEntry = (entry) => PATCH_TYPES.has(entry?.type)

const getPayloadId = (item) => item?.id

const omitNodePosition = (node = {}) => {
  const { position, ...rest } = node
  return rest
}

const createMovePatch = ({ collection, previousItem, nextItem, clone }) => ({
  type: 'move',
  payload: {
    collection,
    id: getPayloadId(nextItem),
    from: clone(previousItem.position || { x: 0, y: 0 }),
    to: clone(nextItem.position || { x: 0, y: 0 })
  }
})

const createUpdatePatch = ({ collection, previousItem, nextItem, clone }) => ({
  type: 'update',
  payload: {
    collection,
    id: getPayloadId(nextItem),
    before: clone(previousItem),
    after: clone(nextItem)
  }
})

const createCollectionPatches = ({ collection, previousItems = [], nextItems = [], clone }) => {
  const previousById = new Map(previousItems.map((item) => [getPayloadId(item), item]))
  const nextById = new Map(nextItems.map((item) => [getPayloadId(item), item]))
  const patches = []

  nextItems.forEach((nextItem) => {
    const id = getPayloadId(nextItem)
    if (!previousById.has(id)) return

    const previousItem = previousById.get(id)
    if (isEqual(previousItem, nextItem)) return

    if (
      collection === 'nodes' &&
      !isEqual(previousItem.position, nextItem.position) &&
      isEqual(omitNodePosition(previousItem), omitNodePosition(nextItem))
    ) {
      patches.push(createMovePatch({ collection, previousItem, nextItem, clone }))
      return
    }

    patches.push(createUpdatePatch({ collection, previousItem, nextItem, clone }))
  })

  previousItems.forEach((previousItem) => {
    const id = getPayloadId(previousItem)
    if (!nextById.has(id)) {
      patches.push({
        type: 'remove',
        payload: {
          collection,
          id,
          item: clone(previousItem)
        }
      })
    }
  })

  nextItems.forEach((nextItem) => {
    const id = getPayloadId(nextItem)
    if (!previousById.has(id)) {
      patches.push({
        type: 'add',
        payload: {
          collection,
          id,
          item: clone(nextItem)
        }
      })
    }
  })

  return patches
}

const createCanvasHistoryPatches = ({ previousState, nextState }, clone = defaultClone) =>
  COLLECTION_NAMES.flatMap((collection) => createCollectionPatches({
    collection,
    previousItems: previousState?.[collection] || [],
    nextItems: nextState?.[collection] || [],
    clone
  }))

export const createCanvasHistoryEntry = ({ previousState = null, nextState }, clone = defaultClone) => {
  const normalizedNextState = createCanvasHistoryState(nextState || createEmptyState(), clone)
  if (!previousState) {
    return createSnapshotEntry(normalizedNextState, clone)
  }

  const patches = createCanvasHistoryPatches({
    previousState,
    nextState: normalizedNextState
  }, clone)

  if (!patches.length) {
    return {
      type: 'noop',
      payload: {}
    }
  }

  if (patches.length === 1) {
    return patches[0]
  }

  return {
    type: 'transaction',
    payload: {
      patches
    }
  }
}

const getPatchList = (entry, direction = 'forward') => {
  if (entry?.type === 'transaction') {
    const patches = entry.payload?.patches || []
    return direction === 'backward' ? patches.slice().reverse() : patches
  }
  if (isPatchEntry(entry)) return [entry]
  return []
}

const removeItem = (items, id) => items.filter((item) => getPayloadId(item) !== id)

const upsertItem = (items, item, clone = defaultClone) => {
  const clonedItem = clone(item)
  const index = items.findIndex((candidate) => getPayloadId(candidate) === getPayloadId(item))
  if (index === -1) return [...items, clonedItem]

  const nextItems = items.slice()
  nextItems[index] = clonedItem
  return nextItems
}

const applyPatch = (state, patch, direction = 'forward', clone = defaultClone) => {
  if (!patch || patch.type === 'noop') return state

  const collection = patch.payload?.collection
  if (!COLLECTION_NAMES.includes(collection)) return state

  if (patch.type === 'add') {
    state[collection] = direction === 'forward'
      ? upsertItem(state[collection], patch.payload.item, clone)
      : removeItem(state[collection], patch.payload.id)
    return state
  }

  if (patch.type === 'remove') {
    state[collection] = direction === 'forward'
      ? removeItem(state[collection], patch.payload.id)
      : upsertItem(state[collection], patch.payload.item, clone)
    return state
  }

  if (patch.type === 'update') {
    const item = direction === 'forward' ? patch.payload.after : patch.payload.before
    state[collection] = upsertItem(state[collection], item, clone)
    return state
  }

  if (patch.type === 'move') {
    const position = direction === 'forward' ? patch.payload.to : patch.payload.from
    state[collection] = state[collection].map((item) => {
      if (getPayloadId(item) !== patch.payload.id) return item
      return {
        ...item,
        position: clone(position)
      }
    })
  }

  return state
}

export const applyCanvasHistoryEntry = ({ state, entry, direction = 'forward' }, clone = defaultClone) => {
  if (entry?.type === 'snapshot') {
    return createCanvasHistoryState(entry.payload, clone)
  }

  const nextState = createCanvasHistoryState(state || createEmptyState(), clone)
  getPatchList(entry, direction).forEach((patch) => {
    applyPatch(nextState, patch, direction, clone)
  })
  return nextState
}

export const resolveCanvasHistoryState = ({ history = [], historyIndex = -1 }, clone = defaultClone) => {
  if (historyIndex < 0) return null

  let state = null
  const endIndex = Math.min(historyIndex, history.length - 1)
  for (let index = 0; index <= endIndex; index += 1) {
    const entry = history[index]
    if (entry?.type === 'snapshot') {
      state = createCanvasHistoryState(entry.payload, clone)
      continue
    }
    if (isLegacySnapshot(entry)) {
      state = createCanvasHistoryState(entry, clone)
      continue
    }
    state = applyCanvasHistoryEntry({ state: state || createEmptyState(), entry }, clone)
  }

  return state
}

export const pushCanvasHistoryState = ({
  history = [],
  historyIndex = -1,
  state,
  maxHistory = 50,
  clone = defaultClone
}) => {
  let nextHistory = Array.isArray(history) ? history.slice() : []
  let nextHistoryIndex = historyIndex

  if (historyIndex < nextHistory.length - 1) {
    nextHistory = nextHistory.slice(0, historyIndex + 1)
  }

  const previousState = resolveCanvasHistoryState({
    history: nextHistory,
    historyIndex: nextHistoryIndex
  }, clone)
  const entry = createCanvasHistoryEntry({
    previousState,
    nextState: state
  }, clone)

  nextHistory.push(entry)

  if (nextHistory.length > maxHistory) {
    const firstRetainedState = resolveCanvasHistoryState({
      history: nextHistory,
      historyIndex: 1
    }, clone)
    nextHistory = [
      createSnapshotEntry(firstRetainedState, clone),
      ...nextHistory.slice(2)
    ]
    nextHistoryIndex = nextHistory.length - 1
  } else {
    nextHistoryIndex += 1
  }

  return {
    history: nextHistory,
    historyIndex: nextHistoryIndex
  }
}

export const getUndoHistoryState = ({ history = [], historyIndex = -1, currentState = null }, clone = defaultClone) => {
  if (historyIndex <= 0) {
    return {
      changed: false,
      historyIndex,
      state: null
    }
  }

  const nextHistoryIndex = historyIndex - 1
  const currentEntry = history[historyIndex]
  const state = currentState && isPatchEntry(currentEntry)
    ? applyCanvasHistoryEntry({
        state: currentState,
        entry: currentEntry,
        direction: 'backward'
      }, clone)
    : resolveCanvasHistoryState({
        history,
        historyIndex: nextHistoryIndex
      }, clone)

  return {
    changed: true,
    historyIndex: nextHistoryIndex,
    state
  }
}

export const getRedoHistoryState = ({ history = [], historyIndex = -1, currentState = null }, clone = defaultClone) => {
  if (historyIndex >= history.length - 1) {
    return {
      changed: false,
      historyIndex,
      state: null
    }
  }

  const nextHistoryIndex = historyIndex + 1
  const nextEntry = history[nextHistoryIndex]
  const state = currentState && isPatchEntry(nextEntry)
    ? applyCanvasHistoryEntry({
        state: currentState,
        entry: nextEntry,
        direction: 'forward'
      }, clone)
    : resolveCanvasHistoryState({
        history,
        historyIndex: nextHistoryIndex
      }, clone)

  return {
    changed: true,
    historyIndex: nextHistoryIndex,
    state
  }
}

export const measureCanvasHistorySize = (history = []) => JSON.stringify(history).length
