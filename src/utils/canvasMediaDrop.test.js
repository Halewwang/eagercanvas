import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCanvasDroppedImageNodeData,
  createCanvasDroppedImageUploadedPatch,
  createCanvasDroppedVideoNodeData,
  createCanvasDroppedVideoUploadedPatch,
  getCanvasMediaDropFiles,
  getCanvasMediaDropOrigin,
  getCanvasMediaDropPosition,
  getCanvasMediaFileKind,
  shouldHandleCanvasMediaDrag
} from './canvasMediaDrop.js'

const createFile = ({ name, type = '', size = 1024 } = {}) => ({ name, type, size })

test('canvas media drop filters local files into image and video entries', () => {
  const image = createFile({ name: 'scene.PNG', type: 'image/png' })
  const video = createFile({ name: 'clip.MOV' })
  const text = createFile({ name: 'notes.txt', type: 'text/plain' })

  assert.equal(getCanvasMediaFileKind(image), 'image')
  assert.equal(getCanvasMediaFileKind(video), 'video')
  assert.equal(getCanvasMediaFileKind(text), '')
  assert.deepEqual(
    getCanvasMediaDropFiles({ files: [image, video, text] }).map((entry) => [entry.kind, entry.file.name]),
    [
      ['image', 'scene.PNG'],
      ['video', 'clip.MOV']
    ]
  )
})

test('canvas media drop falls back to DataTransfer items when files are not exposed yet', () => {
  const file = createFile({ name: 'asset.webp', type: '' })
  const dataTransfer = {
    files: [],
    items: [
      { kind: 'string', getAsFile: () => createFile({ name: 'ignored.png', type: 'image/png' }) },
      { kind: 'file', getAsFile: () => file }
    ]
  }

  assert.deepEqual(getCanvasMediaDropFiles(dataTransfer), [{ kind: 'image', file }])
})

test('canvas media drag accepts browser file drags and rejects unrelated drags', () => {
  assert.equal(shouldHandleCanvasMediaDrag({ types: ['Files'] }), true)
  assert.equal(shouldHandleCanvasMediaDrag({ types: ['text/plain'] }), false)
  assert.equal(shouldHandleCanvasMediaDrag({ files: [createFile({ name: 'movie.mp4', type: 'video/mp4' })] }), true)
  assert.equal(shouldHandleCanvasMediaDrag({ files: [createFile({ name: 'archive.zip', type: 'application/zip' })] }), false)
})

test('canvas media drop positions nodes at the visible drop point with stable grid offsets', () => {
  const origin = getCanvasMediaDropOrigin({
    event: { clientX: 300, clientY: 180 },
    viewport: { x: -100, y: -60, zoom: 2 }
  })

  assert.deepEqual(origin, { x: 200, y: 120 })
  assert.deepEqual(getCanvasMediaDropPosition({ origin, index: 0 }), { x: 200, y: 120 })
  assert.deepEqual(getCanvasMediaDropPosition({ origin, index: 4 }), { x: 360, y: 262 })
})

test('dropped image node data keeps an immediate preview and upload metadata', () => {
  assert.deepEqual(createCanvasDroppedImageNodeData({
    file: createFile({ name: 'source.png', type: 'image/png' }),
    previewUrl: 'blob:http://local/image',
    dimensions: { width: 1920, height: 1080 },
    now: 1234
  }), {
    url: 'blob:http://local/image',
    previewUrl: 'blob:http://local/image',
    base64: '',
    fileName: 'source.png',
    fileType: 'image/png',
    label: 'Image',
    ratio: '16:9',
    size: '1920x1080',
    loading: false,
    error: '',
    persistStatus: 'uploading',
    persistError: '',
    sourceRefImages: ['blob:http://local/image'],
    updatedAt: 1234
  })

  assert.deepEqual(createCanvasDroppedImageUploadedPatch({
    file: createFile({ name: 'source.png', type: 'image/png' }),
    uploadedUrl: 'https://cdn.example.com/source.png',
    now: 5678
  }), {
    url: 'https://cdn.example.com/source.png',
    previewUrl: '',
    base64: '',
    fileName: 'source.png',
    fileType: 'image/png',
    updatedAt: 5678,
    loading: false,
    error: '',
    persistStatus: 'saving',
    persistError: '',
    sourceRefImages: ['https://cdn.example.com/source.png']
  })
})

test('dropped video node data keeps a playable preview and stable uploaded patch', () => {
  assert.deepEqual(createCanvasDroppedVideoNodeData({
    file: createFile({ name: 'clip.mp4', type: 'video/mp4' }),
    previewUrl: 'blob:http://local/video',
    now: 1234
  }), {
    url: 'blob:http://local/video',
    fileName: 'clip.mp4',
    fileType: 'video/mp4',
    label: 'Video',
    loading: false,
    error: '',
    updatedAt: 1234
  })

  assert.deepEqual(createCanvasDroppedVideoUploadedPatch({
    file: createFile({ name: 'clip.mp4', type: 'video/mp4' }),
    uploadedUrl: 'https://cdn.example.com/clip.mp4',
    now: 5678
  }), {
    url: 'https://cdn.example.com/clip.mp4',
    fileName: 'clip.mp4',
    fileType: 'video/mp4',
    updatedAt: 5678,
    loading: false,
    error: ''
  })
})
