import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildImageGenerationAssets,
  persistImageResultAssets,
  persistVideoResultAsset
} from './runs.service.js'

test('persistImageResultAssets replaces provider image URLs before history is stored', async () => {
  const result = await persistImageResultAssets(
    {
      data: [
        {
          url: 'https://provider.example.com/raw-image.png'
        }
      ]
    },
    {
      sourceNodeId: 'node_image_1',
      persistRemoteUrl: async (url, fileName) => {
        assert.equal(url, 'https://provider.example.com/raw-image.png')
        assert.match(fileName, /^generated-\d+-0\.png$/)
        return 'https://storage.example.com/persisted-image.png'
      }
    }
  )

  assert.equal(result.data[0].url, 'https://storage.example.com/persisted-image.png')
})

test('persistImageResultAssets uploads inline data image URLs before history is stored', async () => {
  const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM='

  const result = await persistImageResultAssets(
    {
      data: [
        {
          url: dataUrl
        }
      ]
    },
    {
      persistDataUrl: async (url, fileName) => {
        assert.equal(url, dataUrl)
        assert.match(fileName, /^generated-\d+-0\.png$/)
        return 'https://storage.example.com/persisted-inline-image.png'
      },
      persistRemoteUrl: async () => {
        throw new Error('remote upload should not handle data URLs')
      }
    }
  )

  assert.equal(result.data[0].url, 'https://storage.example.com/persisted-inline-image.png')
})

test('buildImageGenerationAssets excludes inline data URLs from media history', () => {
  const assets = buildImageGenerationAssets({
    data: [
      { url: 'https://storage.example.com/persisted-image.png' },
      { url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=' }
    ]
  })

  assert.deepEqual(assets, [
    {
      kind: 'image',
      url: 'https://storage.example.com/persisted-image.png',
      previewUrl: 'https://storage.example.com/persisted-image.png',
      fileName: 'generated-1.png',
      fileType: 'image/png',
      origin: 'generation'
    }
  ])
})

test('persistVideoResultAsset replaces provider video URLs before history is stored', async () => {
  const result = await persistVideoResultAsset(
    {
      status: 'completed',
      video_url: 'https://provider.example.com/raw-video.mp4',
      data: {
        task_result: {
          videos: [
            {
              url: 'https://provider.example.com/raw-video.mp4'
            }
          ]
        }
      }
    },
    {
      sourceNodeId: 'node_video_1',
      persistRemoteUrl: async (url, fileName) => {
        assert.equal(url, 'https://provider.example.com/raw-video.mp4')
        assert.match(fileName, /^video-\d+\.mp4$/)
        return 'https://storage.example.com/persisted-video.mp4'
      }
    }
  )

  assert.equal(result.video_url, 'https://storage.example.com/persisted-video.mp4')
  assert.equal(result.data.task_result.videos[0].url, 'https://storage.example.com/persisted-video.mp4')
})
