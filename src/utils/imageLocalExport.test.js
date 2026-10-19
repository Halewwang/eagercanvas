import assert from 'node:assert/strict'
import test from 'node:test'

import { exportImageLocally } from './imageLocalExport.js'

const createHarness = ({ width = 2000, height = 1000, blob = new Blob(['png'], { type: 'image/png' }) } = {}) => {
  const img = { naturalWidth: width, naturalHeight: height }
  const draws = []
  const cleanups = []
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    toBlob: (resolve, type) => {
      canvas.blobType = type
      resolve(blob)
    }
  }
  const options = {
    source: 'image-source',
    loadImageElement: async () => ({ img, cleanup: () => cleanups.push(true) }),
    createCanvas: () => canvas
  }
  return { img, draws, cleanups, canvas, options, blob }
}

test('local image export keeps original pixels and encodes PNG', async () => {
  const h = createHarness()
  const result = await exportImageLocally({ ...h.options, fileName: 'photo.jpg' })
  assert.deepEqual(result, { blob: h.blob, fileName: 'photo.png', width: 2000, height: 1000 })
  assert.deepEqual(h.draws, [[h.img, 0, 0, 2000, 1000, 0, 0, 2000, 1000]])
  assert.equal(h.canvas.blobType, 'image/png')
  assert.deepEqual(h.cleanups, [true])
})

test('local image export uses natural crop coordinates and scales its longest edge', async () => {
  const h = createHarness()
  const result = await exportImageLocally({
    ...h.options,
    cropRect: { x: 100, y: 50, width: 500, height: 250 },
    maxEdge: 2048
  })
  assert.deepEqual(h.draws, [[h.img, 100, 50, 500, 250, 0, 0, 2048, 1024]])
  assert.equal(h.canvas.width, 2048)
  assert.equal(h.canvas.height, 1024)
  assert.deepEqual([result.width, result.height], [2048, 1024])
})

test('local image export preserves portrait proportions and rounds only destination pixels', async () => {
  const h = createHarness({ width: 1000, height: 3000 })
  const result = await exportImageLocally({ ...h.options, maxEdge: 1024 })
  assert.deepEqual([result.width, result.height], [341, 1024])
})

test('local image export keeps current crop pixels when original size is selected', async () => {
  const h = createHarness()
  const result = await exportImageLocally({ ...h.options, cropRect: { x: 1900, y: 900, width: 100, height: 100 } })
  assert.deepEqual([result.width, result.height], [100, 100])
})

test('local image export maps thumbnail crop coordinates to decoded original pixels', async () => {
  const h = createHarness({ width: 5120, height: 2560 })
  const options = {
    ...h.options,
    cropRect: { x: 320, y: 160, width: 640, height: 320 },
    cropSourceSize: { width: 1280, height: 640 }
  }
  const original = await exportImageLocally(options)
  assert.deepEqual([original.width, original.height], [2560, 1280])
  assert.deepEqual(h.draws[0], [h.img, 1280, 640, 2560, 1280, 0, 0, 2560, 1280])

  const resized = await exportImageLocally({ ...options, maxEdge: 1024 })
  assert.deepEqual([resized.width, resized.height], [1024, 512])
  assert.deepEqual(h.draws[1], [h.img, 1280, 640, 2560, 1280, 0, 0, 1024, 512])
})

test('local image export validates crop coordinate dimensions and bounds before scaling', async () => {
  for (const cropSourceSize of [{}, 0, false, { width: 0, height: 100 }, { width: NaN, height: 100 },
    { width: Infinity, height: 100 }, { width: 100, height: -1 }, { width: '100', height: 100 }]) {
    const h = createHarness()
    await assert.rejects(() => exportImageLocally({
      ...h.options, cropRect: { x: 0, y: 0, width: 10, height: 10 }, cropSourceSize
    }), /Invalid crop source dimensions/)
    assert.equal(h.draws.length, 0)
    assert.deepEqual(h.cleanups, [true])
  }

  const h = createHarness({ width: 5120, height: 2560 })
  await assert.rejects(() => exportImageLocally({
    ...h.options,
    cropRect: { x: 1000, y: 0, width: 500, height: 300 },
    cropSourceSize: { width: 1280, height: 640 }
  }), /Invalid crop rectangle/)
  assert.equal(h.draws.length, 0)
})

test('local image export rejects unsupported sizing before loading the image', async () => {
  for (const maxEdge of [-1, 512, 4097, '1024', NaN, Infinity]) {
    await assert.rejects(() => exportImageLocally({
      source: 'source',
      maxEdge,
      loadImageElement: () => { throw new Error('must not load') }
    }), /Invalid export size/)
  }
})

test('local image export validates decoded image sizes and source crop bounds', async () => {
  for (const size of [{ width: 0 }, { height: NaN }, { width: Infinity }, { height: -1 }]) {
    const h = createHarness(size)
    await assert.rejects(() => exportImageLocally(h.options), /Invalid image dimensions/)
    assert.deepEqual(h.cleanups, [true])
    assert.equal(h.draws.length, 0)
  }
  for (const cropRect of [
    {}, { x: -1, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: 1999, y: 0, width: 2, height: 1 },
    { x: 0, y: 999, width: 1, height: 2 },
    { x: NaN, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: Infinity, height: 1 },
    { x: '0', y: 0, width: 1, height: 1 }
  ]) {
    const h = createHarness()
    await assert.rejects(() => exportImageLocally({ ...h.options, cropRect }), /Invalid crop rectangle/)
    assert.equal(h.draws.length, 0)
    assert.deepEqual(h.cleanups, [true])
  }
})

test('local image export rejects oversized original outputs but permits bounded exports', async () => {
  for (const size of [{ width: 16385, height: 1 }, { width: 10000, height: 10000 }]) {
    const h = createHarness(size)
    await assert.rejects(() => exportImageLocally(h.options), /Export dimensions exceed/)
    assert.equal(h.draws.length, 0)
    const result = await exportImageLocally({ ...h.options, maxEdge: 4096 })
    assert.ok(result.width <= 4096 && result.height <= 4096)
  }
})

test('local image export reports loading failures and blank sources', async () => {
  await assert.rejects(() => exportImageLocally({ source: ' ' }), /No image source/)
  await assert.rejects(() => exportImageLocally({
    source: 'source', loadImageElement: async () => { throw new Error('decode failed') }
  }), /decode failed/)
})

test('local image export cleans up on missing canvas, CORS, empty output, and encoding errors', async () => {
  for (const configure of [
    (h) => { h.canvas.getContext = () => null },
    (h) => { h.canvas.getContext = () => ({ drawImage: () => { throw new Error('CORS blocked') } }) },
    (h) => { h.canvas.toBlob = (resolve) => resolve(null) },
    (h) => { h.canvas.toBlob = (resolve) => resolve(new Blob([])) },
    (h) => { h.canvas.toBlob = () => { throw new Error('encoding failed') } }
  ]) {
    const h = createHarness()
    configure(h)
    await assert.rejects(() => exportImageLocally(h.options), /unavailable|CORS blocked|empty|encoding failed/)
    assert.deepEqual(h.cleanups, [true])
  }
})

test('local image export times out loading and cleans up an image that finishes late', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const h = createHarness()
  let finishLoad
  const result = exportImageLocally({ ...h.options, loadImageElement: () => new Promise((resolve) => { finishLoad = resolve }) })
  const rejected = assert.rejects(result, /Image loading timed out/)
  t.mock.timers.tick(30000)
  await rejected
  finishLoad({ img: h.img, cleanup: () => h.cleanups.push(true) })
  await Promise.resolve()
  assert.deepEqual(h.cleanups, [true])
  assert.equal(h.draws.length, 0)
})

test('local image export times out canvas encoding without leaving the image allocated', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const h = createHarness()
  let markEncodingStarted
  const encodingStarted = new Promise((resolve) => { markEncodingStarted = resolve })
  h.canvas.toBlob = () => markEncodingStarted()
  const result = exportImageLocally(h.options)
  const rejected = assert.rejects(result, /Image encoding timed out/)
  await encodingStarted
  t.mock.timers.tick(30000)
  await rejected
  assert.deepEqual(h.cleanups, [true])
})
