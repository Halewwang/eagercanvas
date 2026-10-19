import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  markImageResultAssetsForClientPersistence,
  persistImageResultAssets,
  persistVideoResultAsset
} from './run-assets.js'

test('persistImageResultAssets replaces remote URLs and leaves inline images for client persistence', async () => {
  const inlineDataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='
  const calls = []

  const result = await persistImageResultAssets(
    {
      data: [
        { url: 'https://provider.example.com/raw-image.png' },
        { url: inlineDataUrl }
      ]
    },
    {
      persistRemoteUrl: async (url, fileName) => {
        calls.push({ type: 'remote', url, fileName })
        return 'https://storage.example.com/persisted-remote.png'
      },
      persistDataUrl: async (url, fileName) => {
        calls.push({ type: 'inline', url, fileName })
        throw new Error('inline data URLs should not block the image response')
      }
    }
  )

  assert.deepEqual(result.data, [
    { url: 'https://storage.example.com/persisted-remote.png' },
    { url: inlineDataUrl, transient: true, persist_error: '' }
  ])
  assert.equal(calls[0].type, 'remote')
  assert.match(calls[0].fileName, /^generated-\d+-0\.png$/)
  assert.equal(calls.length, 1)
})

test('persistImageResultAssets does not wait on inline data URL storage', async () => {
  const inlineDataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='

  const result = await persistImageResultAssets(
    {
      provider: 'derouter',
      data: [
        { url: inlineDataUrl }
      ]
    },
    {
      persistDataUrl: async () => {
        throw new Error('inline data URLs should be handled by the client')
      }
    }
  )

  assert.deepEqual(result.data, [
    {
      url: inlineDataUrl,
      transient: true,
      persist_error: ''
    }
  ])
})

test('persistImageResultAssets uploads oversized inline data URLs before returning to the client', async () => {
  const largeDataUrl = `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`
  const calls = []

  const result = await persistImageResultAssets(
    {
      provider: 'derouter',
      data: [
        { url: largeDataUrl }
      ]
    },
    {
      persistDataUrl: async (url, fileName) => {
        calls.push({ url, fileName })
        return 'https://storage.example.com/persisted-large.png'
      }
    }
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, largeDataUrl)
  assert.match(calls[0].fileName, /^generated-\d+-0\.png$/)
  assert.deepEqual(result.data, [
    { url: 'https://storage.example.com/persisted-large.png' }
  ])
})

test('persistImageResultAssets can force inline data URL upload for queued image tasks', async () => {
  const inlineDataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='
  const calls = []

  const result = await persistImageResultAssets(
    {
      provider: 'derouter',
      data: [
        { url: inlineDataUrl }
      ]
    },
    {
      persistInlineDataUrls: true,
      persistDataUrl: async (url, fileName) => {
        calls.push({ url, fileName })
        return 'https://storage.example.com/persisted-inline.png'
      }
    }
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, inlineDataUrl)
  assert.match(calls[0].fileName, /^generated-\d+-0\.png$/)
  assert.deepEqual(result.data, [
    { url: 'https://storage.example.com/persisted-inline.png' }
  ])
})

test('markImageResultAssetsForClientPersistence marks provider outputs transient without uploading', () => {
  const inlineDataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='
  const result = markImageResultAssetsForClientPersistence({
    data: [
      { url: inlineDataUrl },
      { url: 'https://provider.example.com/generated.png' },
      { url: 'https://storage.example.com/storage/v1/object/public/uploads/generated.png' }
    ]
  })

  assert.deepEqual(result.data, [
    { url: inlineDataUrl, transient: true, persist_error: '' },
    { url: 'https://provider.example.com/generated.png', transient: true, persist_error: '' },
    { url: 'https://storage.example.com/storage/v1/object/public/uploads/generated.png' }
  ])
})

test('buildImageGenerationAssets excludes inline data URLs and keeps source node id', () => {
  const assets = buildImageGenerationAssets(
    {
      data: [
        { url: 'https://storage.example.com/generated.png' },
        { url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=' },
        { url: 'https://provider.example.com/transient.png', transient: true }
      ]
    },
    'node_image_1'
  )

  assert.deepEqual(assets, [
    {
      kind: 'image',
      url: 'https://storage.example.com/generated.png',
      previewUrl: 'https://storage.example.com/generated.png',
      fileName: 'generated-1.png',
      fileType: 'image/png',
      origin: 'generation',
      sourceNodeId: 'node_image_1'
    }
  ])
})

test('persistVideoResultAsset replaces nested provider video URLs', async () => {
  const result = await persistVideoResultAsset(
    {
      video_url: 'https://provider.example.com/raw-video.mp4',
      raw: {
        task_result: {
          video_url: 'https://provider.example.com/raw-video.mp4',
          videos: [
            { url: 'https://provider.example.com/raw-video.mp4' }
          ]
        }
      }
    },
    {
      persistRemoteUrl: async (url, fileName) => {
        assert.equal(url, 'https://provider.example.com/raw-video.mp4')
        assert.match(fileName, /^video-\d+\.mp4$/)
        return 'https://storage.example.com/persisted-video.mp4'
      }
    }
  )

  assert.equal(result.video_url, 'https://storage.example.com/persisted-video.mp4')
  assert.equal(result.raw.task_result.video_url, 'https://storage.example.com/persisted-video.mp4')
  assert.equal(result.raw.task_result.videos[0].url, 'https://storage.example.com/persisted-video.mp4')
})

test('buildVideoGenerationAssets prefers source node id from provider result metadata', () => {
  const assets = buildVideoGenerationAssets(
    {
      url: 'https://storage.example.com/generated-video.mp4',
      source_node_id: 'node_from_result'
    },
    'node_from_payload'
  )

  assert.deepEqual(assets, [
    {
      kind: 'video',
      url: 'https://storage.example.com/generated-video.mp4',
      previewUrl: 'https://storage.example.com/generated-video.mp4',
      fileName: 'generated-video.mp4',
      fileType: 'video/mp4',
      origin: 'generation',
      sourceNodeId: 'node_from_result'
    }
  ])
})

for (const [mime, extension] of [['jpeg', 'jpg'], ['webp', 'webp']]) {
  test(`persisted ${mime} output keeps its MIME and extension in storage and media assets`, async () => {
    const dataUrl = `data:image/${mime};base64,aW1hZ2U=`
    const result = await persistImageResultAssets({ data: [{ url: dataUrl }] }, {
      persistInlineDataUrls: true,
      persistDataUrl: async (url, fileName) => {
        assert.equal(url, dataUrl)
        assert.ok(fileName.endsWith(`.${extension}`))
        return `https://storage.example.com/${fileName}`
      }
    })
    const assets = buildImageGenerationAssets(result, 'source-image')
    assert.equal(assets[0].fileName, `generated-1.${extension}`)
    assert.equal(assets[0].fileType, `image/${mime}`)
    assert.equal(assets[0].sourceNodeId, 'source-image')
  })
}

test('existing JPEG and WebP asset URLs keep their file types when a query string is present', () => {
  const assets = buildImageGenerationAssets({ data: [
    { url: 'https://storage.example.com/generated.jpeg?download=image.png' },
    { url: 'https://storage.example.com/generated.webp?download=image.png' }
  ] })
  assert.deepEqual(assets.map(asset => [asset.fileName, asset.fileType]), [
    ['generated-1.jpg', 'image/jpeg'],
    ['generated-2.webp', 'image/webp']
  ])
})
