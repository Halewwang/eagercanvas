import assert from 'node:assert/strict'
import test from 'node:test'

import { loadImageElementFromSource } from './imageElementLoader.js'

const createImageHarness = ({ fail = false } = {}) => {
  let instance = null

  class TestImage {
    constructor() {
      instance = this
      this.crossOrigin = ''
      this.decoding = ''
      this.onerror = null
      this.onload = null
      this.sources = []
    }

    set src(value) {
      this.sources.push(value)
      this.currentSrc = value
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Error('image load failed'))
        else this.onload?.()
      })
    }

    get src() {
      return this.currentSrc
    }
  }

  return {
    getImage: () => instance,
    imageCtor: TestImage
  }
}

test('image element loader resolves remote images through an object url and cleanup revokes it', async () => {
  const fetched = []
  const objectUrlInputs = []
  const revoked = []
  const blob = { type: 'image/png' }
  const { getImage, imageCtor } = createImageHarness()

  const loaded = await loadImageElementFromSource('https://example.test/source.png', {
    createObjectURL: (value) => {
      objectUrlInputs.push(value)
      return 'blob:loaded-image'
    },
    fetchImage: async (url) => {
      fetched.push(url)
      return { blob: async () => blob }
    },
    imageCtor,
    revokeObjectURL: (url) => revoked.push(url)
  })

  assert.equal(loaded.img, getImage())
  assert.equal(getImage().decoding, 'async')
  assert.equal(getImage().src, 'blob:loaded-image')
  assert.deepEqual(fetched, ['https://example.test/source.png'])
  assert.deepEqual(objectUrlInputs, [blob])

  loaded.cleanup()
  assert.deepEqual(revoked, ['blob:loaded-image'])
})

test('image element loader falls back to cross-origin source when remote fetch fails', async () => {
  const revoked = []
  const { getImage, imageCtor } = createImageHarness()

  const loaded = await loadImageElementFromSource('https://example.test/fallback.png', {
    createObjectURL: () => {
      throw new Error('createObjectURL should not run')
    },
    fetchImage: async () => {
      throw new Error('fetch failed')
    },
    imageCtor,
    revokeObjectURL: (url) => revoked.push(url)
  })

  assert.equal(loaded.img, getImage())
  assert.equal(getImage().crossOrigin, 'anonymous')
  assert.equal(getImage().src, 'https://example.test/fallback.png')

  loaded.cleanup()
  assert.deepEqual(revoked, [])
})

test('image element loader keeps data image sources local without fetch or object url cleanup', async () => {
  const { getImage, imageCtor } = createImageHarness()
  const loaded = await loadImageElementFromSource('data:image/png;base64,abc123', {
    createObjectURL: () => {
      throw new Error('createObjectURL should not run')
    },
    fetchImage: async () => {
      throw new Error('fetch should not run')
    },
    imageCtor,
    revokeObjectURL: () => {
      throw new Error('revokeObjectURL should not run')
    }
  })

  assert.equal(loaded.img, getImage())
  assert.equal(getImage().src, 'data:image/png;base64,abc123')
  loaded.cleanup()
})

test('image element loader rejects blank sources before creating an image', async () => {
  await assert.rejects(
    () => loadImageElementFromSource('   ', {
      imageCtor: class {
        constructor() {
          throw new Error('image should not be created')
        }
      }
    }),
    /No image source/
  )
})
