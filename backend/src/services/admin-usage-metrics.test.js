import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import { getAdminUsageSummary, getAdminUsageTimeseries } from './admin-usage-metrics.js'

const createAwaitableQuery = ({ data = [], error = null, onCall = () => {} } = {}) => ({
  select(columns) {
    onCall(['select', columns])
    return this
  },
  order(column, options) {
    onCall(['order', column, options])
    return this
  },
  eq(column, value) {
    onCall(['eq', column, value])
    return this
  },
  gte(column, value) {
    onCall(['gte', column, value])
    return this
  },
  lte(column, value) {
    onCall(['lte', column, value])
    return this
  },
  then(resolve, reject) {
    return Promise.resolve({ data, error }).then(resolve, reject)
  }
})

test('getAdminUsageSummary aggregates provider billing records and applies date/user filters', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'provider_billing_records')
    return createAwaitableQuery({
      onCall: (call) => calls.push(call),
      data: [
        {
          user_id: 'user-1',
          input_tokens: 10,
          output_tokens: 5,
          image_count: 2,
          video_seconds: 4,
          cost_amount: 1.5
        },
        {
          user_id: 'user-2',
          input_tokens: 3,
          output_tokens: 7,
          image_count: 1,
          video_seconds: 6,
          cost_amount: 2.25
        }
      ]
    })
  })

  try {
    const summary = await getAdminUsageSummary({
      from: '2026-06-01',
      to: '2026-06-02',
      userId: 'user-1'
    })

    assert.deepEqual(summary, {
      totalCalls: 2,
      totalInputTokens: 13,
      totalOutputTokens: 12,
      totalImages: 3,
      totalVideoSeconds: 10,
      totalCostUsd: 3.75,
      totalUsers: 2
    })
    assert.deepEqual(calls.filter((call) => call[0] !== 'select'), [
      ['eq', 'user_id', 'user-1'],
      ['gte', 'official_created_at', '2026-06-01T00:00:00.000Z'],
      ['lte', 'official_created_at', '2026-06-02T23:59:59.999Z']
    ])
  } finally {
    restore.mock.restore()
  }
})

test('getAdminUsageTimeseries merges duplicate daily aggregate rows by date', async () => {
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'usage_daily_agg')
    return createAwaitableQuery({
      data: [
        {
          date: '2026-06-02',
          user_id: 'user-1',
          total_calls: 1,
          total_tokens: 10,
          total_images: 2,
          total_video_seconds: 4,
          total_cost_usd: 1.5
        },
        {
          date: '2026-06-01',
          user_id: 'user-2',
          total_calls: 3,
          total_tokens: 30,
          total_images: 0,
          total_video_seconds: 6,
          total_cost_usd: 2
        },
        {
          date: '2026-06-02',
          user_id: 'user-3',
          total_calls: 2,
          total_tokens: 20,
          total_images: 1,
          total_video_seconds: 8,
          total_cost_usd: 0.5
        }
      ]
    })
  })

  try {
    const series = await getAdminUsageTimeseries()

    assert.deepEqual(series, [
      {
        date: '2026-06-01',
        total_calls: 3,
        total_tokens: 30,
        total_images: 0,
        total_video_seconds: 6,
        total_cost_usd: 2
      },
      {
        date: '2026-06-02',
        total_calls: 3,
        total_tokens: 30,
        total_images: 3,
        total_video_seconds: 12,
        total_cost_usd: 2
      }
    ])
  } finally {
    restore.mock.restore()
  }
})

test('getAdminUsageTimeseries bounds unfiltered admin dashboard queries by default', async () => {
  const calls = []
  const restore = mock.method(supabase, 'from', (table) => {
    assert.equal(table, 'usage_daily_agg')
    return createAwaitableQuery({
      data: [],
      onCall: (call) => calls.push(call)
    })
  })

  try {
    await getAdminUsageTimeseries({
      now: () => new Date('2026-07-08T12:00:00.000Z')
    })

    assert.deepEqual(calls.filter((call) => call[0] === 'gte'), [
      ['gte', 'date', '2026-03-10']
    ])
  } finally {
    restore.mock.restore()
  }
})
