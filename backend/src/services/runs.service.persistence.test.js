import assert from 'node:assert/strict'
import test from 'node:test'

import {
  build3DGenerationAssets,
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

test('build3DGenerationAssets keeps source node id for later recovery', () => {
  const assets = build3DGenerationAssets(
    {
      previewImageUrl: 'https://storage.example.com/preview.png',
      assets: [
        {
          type: 'glb',
          url: 'https://storage.example.com/model.glb',
          previewImageUrl: 'https://storage.example.com/preview.png'
        }
      ]
    },
    'node_3d_1'
  )

  assert.deepEqual(assets, [
    {
      kind: 'model3d',
      url: 'https://storage.example.com/model.glb',
      previewUrl: 'https://storage.example.com/preview.png',
      fileName: 'model3d-1.glb',
      fileType: 'model/glb',
      origin: 'generation',
      sourceNodeId: 'node_3d_1'
    }
  ])
})
