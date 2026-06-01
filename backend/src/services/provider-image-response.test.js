import assert from 'node:assert/strict'
import test from 'node:test'

import { extractPredictionMeta, normalizeImageResponse } from './providers/image-response.js'

test('provider image response normalizer preserves common image output shapes', () => {
  const longBase64 = 'a'.repeat(140)
  const normalized = normalizeImageResponse({
    candidates: [
      {
        content: {
          parts: [
            { inline_data: { mime_type: 'image/webp', data: longBase64 } },
            { file_data: { file_uri: 'https://cdn.test/gemini.png' } }
          ]
        }
      }
    ],
    data: {
      result: {
        images: [
          { url: 'https://cdn.test/result.png' },
          { b64_json: longBase64, mime_type: 'image/png' }
        ]
      },
      task_result: {
        images: ['https://cdn.test/task-result.png']
      }
    },
    output: ['https://cdn.test/output.png'],
    image_url: 'https://cdn.test/result.png'
  })

  assert.deepEqual(normalized.data.map((item) => item.url), [
    `data:image/webp;base64,${longBase64}`,
    'https://cdn.test/gemini.png',
    'https://cdn.test/result.png',
    `data:image/png;base64,${longBase64}`,
    'https://cdn.test/task-result.png',
    'https://cdn.test/output.png'
  ])
})

test('provider image response extracts prediction metadata from wrapped responses', () => {
  assert.deepEqual(
    extractPredictionMeta({
      id: 'outer-id',
      status: 'queued',
      data: {
        id: 'inner-id',
        status: 'processing',
        error: '',
        urls: { get: 'https://provider.test/result' }
      }
    }),
    {
      id: 'inner-id',
      status: 'processing',
      error: '',
      resultUrl: 'https://provider.test/result'
    }
  )
})
