import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  persistImageResultAssets,
  persistVideoResultAsset
} from './run-assets.js'

test('persistImageResultAssets replaces remote and inline provider image URLs', async () => {
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
        return 'https://storage.example.com/persisted-inline.png'
      }
    }
  )

  assert.deepEqual(result.data.map((entry) => entry.url), [
    'https://storage.example.com/persisted-remote.png',
    'https://storage.example.com/persisted-inline.png'
  ])
  assert.equal(calls[0].type, 'remote')
  assert.match(calls[0].fileName, /^generated-\d+-0\.png$/)
  assert.equal(calls[1].type, 'inline')
  assert.match(calls[1].fileName, /^generated-\d+-1\.png$/)
})

test('persistImageResultAssets does not leak inline data URLs when server synchronization fails', async () => {
  const inlineDataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='

  await assert.rejects(
    () => persistImageResultAssets(
      {
        provider: 'derouter',
        data: [
          { url: inlineDataUrl }
        ]
      },
      {
        persistDataUrl: async () => {
          throw new Error('storage unavailable')
        }
      }
    ),
    /Generated image synchronization failed: storage unavailable/
  )
})

test('buildImageGenerationAssets excludes inline data URLs and keeps source node id', () => {
  const assets = buildImageGenerationAssets(
    {
      data: [
        { url: 'https://storage.example.com/generated.png' },
        { url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=' }
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
