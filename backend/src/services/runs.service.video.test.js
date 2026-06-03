import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { buildVideoGenerationAssets } from './runs.service.js'
import { findGeneratedMediaRecordByRunId, upsertGeneratedMediaRecord } from './media-library.service.js'

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

test('generated media records do not store inline data URLs in metadata assets', async () => {
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
      runId: 'run_image_123',
      projectId: 'project_123',
      runType: 'image',
      model: 'gpt-image-2',
      assets: [
        {
          kind: 'image',
          url: 'https://storage.example.com/generated.png',
          previewUrl: 'https://storage.example.com/generated.png',
          fileName: 'generated-1.png',
          fileType: 'image/png',
          origin: 'generation'
        },
        {
          kind: 'image',
          url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=',
          previewUrl: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=',
          fileName: 'generated-2.png',
          fileType: 'image/png',
          origin: 'generation'
        }
      ]
    })

    assert.equal(result?.assets?.length, 1)
    assert.equal(insertCalls[0]?.metadata?.assets?.length, 1)
    assert.equal(insertCalls[0]?.metadata?.assets?.[0]?.url, 'https://storage.example.com/generated.png')
  } finally {
    restore.mock.restore()
  }
})

test('findGeneratedMediaRecordByRunId returns normalized generated image assets', async () => {
  const eqCalls = []
  const containsCalls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'audit_logs')
    return {
      select() {
        return this
      },
      eq(field, value) {
        eqCalls.push([field, value])
        return this
      },
      contains(field, value) {
        containsCalls.push([field, value])
        return this
      },
      order() {
        return this
      },
      limit() {
        return Promise.resolve({
          data: [
            {
              id: 'log_123',
              created_at: '2026-06-03T03:00:00.000Z',
              metadata: {
                run_id: 'run_image_123',
                project_id: 'project_123',
                run_type: 'image',
                model: 'gpt-image-lite',
                status: 'completed',
                preview_url: 'https://storage.example.com/generated.png',
                output_count: 1,
                assets: [
                  {
                    kind: 'image',
                    url: 'https://storage.example.com/generated.png',
                    previewUrl: 'https://storage.example.com/generated.png',
                    fileName: 'generated-1.png',
                    fileType: 'image/png',
                    origin: 'generation'
                  }
                ]
              }
            }
          ],
          error: null
        })
      }
    }
  })

  try {
    const result = await findGeneratedMediaRecordByRunId({
      userId: 'user_123',
      runId: 'run_image_123'
    })

    assert.deepEqual(eqCalls, [
      ['user_id', 'user_123'],
      ['action', 'media.generated']
    ])
    assert.deepEqual(containsCalls, [
      ['metadata', { run_id: 'run_image_123' }]
    ])
    assert.equal(result.status, 'completed')
    assert.equal(result.model, 'gpt-image-lite')
    assert.equal(result.assets[0].url, 'https://storage.example.com/generated.png')
  } finally {
    restore.mock.restore()
  }
})
