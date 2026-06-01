import assert from 'node:assert/strict'
import test from 'node:test'

import {
  copyWedding3x3PreviewText,
  downloadWedding3x3JsonPreview
} from './Wedding3x3PreviewActions.js'

test('wedding 3x3 preview actions copy preview text and report success', async () => {
  const calls = []

  await copyWedding3x3PreviewText(' prompt copy ', 'Prompt copied.', {
    clipboard: {
      writeText: async (value) => calls.push(['write', value])
    },
    message: {
      success: (value) => calls.push(['success', value]),
      error: (value) => calls.push(['error', value])
    }
  })

  assert.deepEqual(calls, [
    ['write', ' prompt copy '],
    ['success', 'Prompt copied.']
  ])
})

test('wedding 3x3 preview actions report copy failure without throwing', async () => {
  const calls = []

  await copyWedding3x3PreviewText(null, 'JSON copied.', {
    clipboard: {
      writeText: async () => {
        throw new Error('clipboard denied')
      }
    },
    message: {
      success: (value) => calls.push(['success', value]),
      error: (value) => calls.push(['error', value])
    }
  })

  assert.deepEqual(calls, [
    ['error', '复制失败，请重试。']
  ])
})

test('wedding 3x3 preview actions download json and schedule object url cleanup', () => {
  const calls = []
  const link = {
    click: () => calls.push(['click']),
    download: '',
    href: ''
  }
  const documentRef = {
    body: {
      appendChild: (element) => calls.push(['append', element]),
      removeChild: (element) => calls.push(['remove', element])
    },
    createElement: (tag) => {
      calls.push(['createElement', tag])
      return link
    }
  }
  class BlobCtor {
    constructor(parts, options) {
      this.parts = parts
      this.options = options
      calls.push(['blob', parts, options])
    }
  }

  downloadWedding3x3JsonPreview('{"mode":"product_showcase"}', {
    BlobCtor,
    documentRef,
    now: () => 1780000000000,
    setTimeoutRef: (callback, delay) => calls.push(['timeout', callback, delay]),
    urlApi: {
      createObjectURL: (blob) => {
        calls.push(['createObjectURL', blob.parts[0]])
        return 'blob:wedding-json'
      },
      revokeObjectURL: (href) => calls.push(['revokeObjectURL', href])
    },
    message: {
      error: (value) => calls.push(['error', value])
    }
  })

  assert.equal(link.href, 'blob:wedding-json')
  assert.equal(link.download, 'wedding-3x3-1780000000000.json')
  assert.deepEqual(calls.slice(0, 7), [
    ['blob', ['{"mode":"product_showcase"}'], { type: 'application/json;charset=utf-8' }],
    ['createObjectURL', '{"mode":"product_showcase"}'],
    ['createElement', 'a'],
    ['append', link],
    ['click'],
    ['remove', link],
    ['timeout', calls[6][1], 800]
  ])

  calls[6][1]()
  assert.deepEqual(calls.at(-1), ['revokeObjectURL', 'blob:wedding-json'])
})

test('wedding 3x3 preview actions report download failures without throwing', () => {
  const calls = []

  downloadWedding3x3JsonPreview('bad json', {
    BlobCtor: class {
      constructor() {
        throw new Error('blob failed')
      }
    },
    message: {
      error: (value) => calls.push(['error', value])
    }
  })

  assert.deepEqual(calls, [
    ['error', 'JSON 下载失败。']
  ])
})
