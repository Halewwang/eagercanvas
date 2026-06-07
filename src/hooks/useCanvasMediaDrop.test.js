import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hookUrl = new URL('./useCanvasMediaDrop.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const imageDimensionsUrl = new URL('../utils/imageDimensions.js', import.meta.url)
const canvasMediaDropUrl = new URL('../utils/canvasMediaDrop.js', import.meta.url)
const canvasInteractionUrl = new URL('../utils/canvasInteraction.js', import.meta.url)
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/imageDimensions.js'", `from '${imageDimensionsUrl.href}'`)
  .replace("from '@/utils/canvasInteraction.js'", `from '${canvasInteractionUrl.href}'`)
  .replace("from '@/utils/canvasMediaDrop.js'", `from '${canvasMediaDropUrl.href}'`)
const { useCanvasMediaDrop } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createFile = ({ name, type = '', size = 1024 } = {}) => ({ name, type, size })

const createEvent = (files) => {
  let defaultPrevented = false
  let propagationStopped = false
  return {
    clientX: 300,
    clientY: 180,
    dataTransfer: { files, types: ['Files'] },
    preventDefault: () => {
      defaultPrevented = true
    },
    stopPropagation: () => {
      propagationStopped = true
    },
    get defaultPrevented() {
      return defaultPrevented
    },
    get propagationStopped() {
      return propagationStopped
    }
  }
}

test('canvas media drop creates image and video nodes at the drop point, uploads, and saves them', async () => {
  const calls = []
  const image = createFile({ name: 'scene.png', type: 'image/png' })
  const video = createFile({ name: 'clip.mp4', type: 'video/mp4' })
  const event = createEvent([image, video])

  const { handleCanvasMediaDrop } = useCanvasMediaDrop({
    addNode: (type, position, data) => {
      const id = `${type}-${calls.filter((call) => call[0] === 'add-node').length + 1}`
      calls.push(['add-node', id, type, position, data])
      return id
    },
    createObjectURL: (file) => `blob:${file.name}`,
    currentProjectId: () => 'project-1',
    flushSave: async () => {
      calls.push(['flush-save'])
      return true
    },
    getImageDimensionsFromFile: async (file) => {
      calls.push(['dimensions', file.name])
      return { width: 1920, height: 1080 }
    },
    nextTickFn: async () => {
      calls.push(['next-tick'])
    },
    notify: {
      success: (message) => calls.push(['success', message]),
      warning: (message) => calls.push(['warning', message])
    },
    revokeObjectURL: (url) => calls.push(['revoke', url]),
    updateNode: (nodeId, patch) => calls.push(['update-node', nodeId, patch]),
    updateNodeInternals: (nodeId) => calls.push(['internals', nodeId]),
    uploadMediaFile: async (file, options) => {
      calls.push(['upload', file.name, options.projectId, options.source, options.sourceNodeId])
      return `https://cdn.example.com/${file.name}`
    },
    viewport: () => ({ x: -100, y: -60, zoom: 2 })
  })

  await handleCanvasMediaDrop(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(event.propagationStopped, true)
  assert.deepEqual(calls.filter((call) => call[0] === 'add-node').map((call) => [call[2], call[3]]), [
    ['image', { x: 200, y: 120 }],
    ['video', { x: 360, y: 120 }]
  ])
  assert.deepEqual(calls.filter((call) => call[0] === 'upload').map((call) => call.slice(1, 5)), [
    ['scene.png', 'project-1', 'canvas_drop_image', 'image-1'],
    ['clip.mp4', 'project-1', 'canvas_drop_video', 'video-2']
  ])
  assert.deepEqual(calls.filter((call) => call[0] === 'revoke'), [
    ['revoke', 'blob:scene.png'],
    ['revoke', 'blob:clip.mp4']
  ])
  assert.ok(calls.some((call) => call[0] === 'update-node' && call[1] === 'image-1' && call[2].url === 'https://cdn.example.com/scene.png'))
  assert.ok(calls.some((call) => call[0] === 'update-node' && call[1] === 'video-2' && call[2].url === 'https://cdn.example.com/clip.mp4'))
  assert.ok(calls.filter((call) => call[0] === 'flush-save').length >= 3)
  assert.deepEqual(calls.at(-1), ['success', '已从拖拽创建 2 个媒体节点'])
})

test('canvas media drop avoids existing and newly created media node slots', async () => {
  const calls = []
  const image = createFile({ name: 'scene.png', type: 'image/png' })
  const video = createFile({ name: 'clip.mp4', type: 'video/mp4' })
  const event = createEvent([image, video])
  const nodes = [
    {
      id: 'existing-image',
      type: 'image',
      position: { x: 200, y: 120 },
      data: { ratio: '16:9' }
    }
  ]

  const { handleCanvasMediaDrop } = useCanvasMediaDrop({
    addNode: (type, position, data) => {
      const id = `${type}-${calls.filter((call) => call[0] === 'add-node').length + 1}`
      calls.push(['add-node', id, type, position, data])
      nodes.push({ id, type, position, data })
      return id
    },
    createObjectURL: (file) => `blob:${file.name}`,
    currentProjectId: () => 'project-1',
    flushSave: async () => true,
    getImageDimensions: async () => ({ width: 1920, height: 1080 }),
    nextTickFn: async () => {},
    notify: {
      success: () => {},
      warning: () => {}
    },
    revokeObjectURL: () => {},
    updateNode: () => {},
    updateNodeInternals: () => {},
    uploadMediaFile: async (file) => `https://cdn.example.com/${file.name}`,
    viewport: () => ({ x: -100, y: -60, zoom: 2 }),
    nodes: () => nodes
  })

  await handleCanvasMediaDrop(event)

  assert.deepEqual(calls.filter((call) => call[0] === 'add-node').map((call) => [call[2], call[3]]), [
    ['image', { x: 680, y: 120 }],
    ['video', { x: 360, y: 500 }]
  ])
})

test('canvas media dragover prevents browser navigation for local file drags', () => {
  const event = createEvent([])
  const { handleCanvasMediaDragOver } = useCanvasMediaDrop()

  handleCanvasMediaDragOver(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(event.propagationStopped, true)
})

test('canvas media drop warns and does not create nodes for unsupported local files', async () => {
  const calls = []
  const event = createEvent([createFile({ name: 'notes.txt', type: 'text/plain' })])
  const { handleCanvasMediaDrop } = useCanvasMediaDrop({
    addNode: (...args) => calls.push(['add-node', ...args]),
    notify: {
      warning: (message) => calls.push(['warning', message])
    }
  })

  await handleCanvasMediaDrop(event)

  assert.equal(event.defaultPrevented, true)
  assert.equal(event.propagationStopped, true)
  assert.deepEqual(calls, [['warning', '拖拽文件中没有可创建的图片或视频']])
})
