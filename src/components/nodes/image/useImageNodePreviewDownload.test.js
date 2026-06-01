import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getImageNodePreviewDownloadFilename,
  useImageNodePreviewDownload
} from './useImageNodePreviewDownload.js'

test('image node preview download filename sanitizes labels and preserves source extensions', () => {
  assert.equal(getImageNodePreviewDownloadFilename({
    label: '  Product Hero / Final  ',
    sourceUrl: 'https://cdn.example.com/assets/result.WEBP?token=1',
    baseUrl: 'https://app.example.com'
  }), 'Product-Hero-Final.webp')

  assert.equal(getImageNodePreviewDownloadFilename({
    label: '***',
    sourceUrl: 'not a valid url',
    baseUrl: 'https://app.example.com'
  }), 'image-preview.png')
})

test('image node preview download fetches a blob, triggers a temporary object url download, and schedules cleanup', async () => {
  const calls = []
  const previewDownload = useImageNodePreviewDownload({
    createObjectUrl: (blob) => {
      calls.push(['create-object-url', blob])
      return 'blob:preview'
    },
    fetchFn: async (url) => {
      calls.push(['fetch', url])
      return {
        ok: true,
        blob: async () => 'blob-data'
      }
    },
    getBaseUrl: () => 'https://app.example.com',
    getLabel: () => 'Preview Result',
    getSourceUrl: () => 'https://cdn.example.com/result.png',
    revokeObjectUrl: (url) => calls.push(['revoke', url]),
    setTimeoutFn: (callback, delay) => {
      calls.push(['timeout', delay])
      callback()
      return 1
    },
    triggerDownload: (href, filename) => calls.push(['download', href, filename])
  })

  const result = await previewDownload.downloadPreviewImage()

  assert.deepEqual(result, {
    filename: 'Preview-Result.png',
    href: 'blob:preview',
    source: 'blob'
  })
  assert.deepEqual(calls, [
    ['fetch', 'https://cdn.example.com/result.png'],
    ['create-object-url', 'blob-data'],
    ['download', 'blob:preview', 'Preview-Result.png'],
    ['timeout', 1000],
    ['revoke', 'blob:preview']
  ])
})

test('image node preview download falls back to the original source when blob download fails', async () => {
  const calls = []
  const previewDownload = useImageNodePreviewDownload({
    fetchFn: async () => ({ ok: false, status: 403 }),
    getBaseUrl: () => 'https://app.example.com',
    getLabel: () => 'Fallback',
    getSourceUrl: () => '/images/fallback.jpeg',
    triggerDownload: (href, filename) => calls.push(['download', href, filename])
  })

  const result = await previewDownload.downloadPreviewImage()

  assert.deepEqual(result, {
    filename: 'Fallback.jpeg',
    href: '/images/fallback.jpeg',
    source: 'fallback'
  })
  assert.deepEqual(calls, [['download', '/images/fallback.jpeg', 'Fallback.jpeg']])
})

test('image node preview download skips empty sources', async () => {
  const calls = []
  const previewDownload = useImageNodePreviewDownload({
    getSourceUrl: () => '   ',
    triggerDownload: () => calls.push(['download'])
  })

  assert.equal(await previewDownload.downloadPreviewImage(), null)
  assert.deepEqual(calls, [])
})
