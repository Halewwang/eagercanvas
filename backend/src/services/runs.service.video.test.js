import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { buildVideoGenerationAssets } from './runs.service.js'
import { upsertGeneratedMediaRecord } from './media-library.service.js'

test('video generation assets keep source node id for later recovery', () => {
  const assets = buildVideoGenerationAssets(
    {
      url: 'https://example.com/generated.mp4'
    },
    'node_video_123'
  )

  assert.deepEqual(assets, [
    {
      kind: 'video',
      url: 'https://example.com/generated.mp4',
      previewUrl: 'https://example.com/generated.mp4',
      fileName: 'generated-video.mp4',
      fileType: 'video/mp4',
      origin: 'generation',
      sourceNodeId: 'node_video_123'
    }
  ])
})

test('generated video media records keep source node id in metadata assets', async () => {
  const insertCalls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'audit_logs')
    return {
      select() {
        return this
      },
      eq() {
        return this
      },
      contains() {
        return this
      },
      limit() {
        return Promise.resolve({ data: [], error: null })
      },
      insert(payload) {
        insertCalls.push(payload)
        return Promise.resolve({ error: null })
      }
    }
  })

  try {
    const result = await upsertGeneratedMediaRecord({
      userId: 'user_123',
      runId: 'run_video_123',
      projectId: 'project_123',
      runType: 'video',
      model: 'seedance-2.0',
      assets: [
        {
          kind: 'video',
          url: 'https://example.com/generated.mp4',
          previewUrl: 'https://example.com/generated.mp4',
          fileName: 'generated-video.mp4',
          fileType: 'video/mp4',
          origin: 'generation',
          sourceNodeId: 'node_video_123'
        }
      ]
    })

    assert.equal(result?.assets?.[0]?.sourceNodeId, 'node_video_123')
    assert.equal(insertCalls[0]?.metadata?.assets?.[0]?.sourceNodeId, 'node_video_123')
  } finally {
    restore.mock.restore()
  }
})
