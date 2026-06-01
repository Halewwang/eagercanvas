import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const toIsoDateStart = (value) => {
  const val = String(value || '').trim()
  return val ? `${val}T00:00:00.000Z` : ''
}

const toIsoDateEnd = (value) => {
  const val = String(value || '').trim()
  return val ? `${val}T23:59:59.999Z` : ''
}

export const getAdminUsageSummary = async ({ from, to, userId } = {}) => {
  const query = supabase
    .from('provider_billing_records')
    .select('user_id,input_tokens,output_tokens,image_count,video_seconds,cost_amount,official_created_at')

  if (userId) query.eq('user_id', String(userId))
  if (from) query.gte('official_created_at', toIsoDateStart(from))
  if (to) query.lte('official_created_at', toIsoDateEnd(to))

  const { data, error } = await query
  if (error) {
    if (isMissingRelation(error)) {
      return { totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalImages: 0, totalVideoSeconds: 0, totalCostUsd: 0, totalUsers: 0 }
    }
    throw new HttpError(500, error.message, 'ADMIN_USAGE_SUMMARY_FAILED')
  }

  const users = new Set()
  const summary = (data || []).reduce((acc, item) => {
    users.add(item.user_id)
    acc.totalCalls += 1
    acc.totalInputTokens += Number(item.input_tokens || 0)
    acc.totalOutputTokens += Number(item.output_tokens || 0)
    acc.totalImages += Number(item.image_count || 0)
    acc.totalVideoSeconds += Number(item.video_seconds || 0)
    acc.totalCostUsd += Number(item.cost_amount || 0)
    return acc
  }, {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalImages: 0,
    totalVideoSeconds: 0,
    totalCostUsd: 0
  })

  return {
    ...summary,
    totalUsers: users.size
  }
}

export const getAdminUsageTimeseries = async ({ from, to, userId } = {}) => {
  const query = supabase
    .from('usage_daily_agg')
    .select('date,user_id,total_calls,total_tokens,total_images,total_video_seconds,total_cost_usd')
    .order('date', { ascending: true })

  if (userId) query.eq('user_id', String(userId))
  if (from) query.gte('date', String(from))
  if (to) query.lte('date', String(to))

  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, 'ADMIN_USAGE_SERIES_FAILED')

  const map = new Map()
  for (const row of data || []) {
    const key = String(row.date)
    const current = map.get(key) || {
      date: key,
      total_calls: 0,
      total_tokens: 0,
      total_images: 0,
      total_video_seconds: 0,
      total_cost_usd: 0
    }
    current.total_calls += Number(row.total_calls || 0)
    current.total_tokens += Number(row.total_tokens || 0)
    current.total_images += Number(row.total_images || 0)
    current.total_video_seconds += Number(row.total_video_seconds || 0)
    current.total_cost_usd += Number(row.total_cost_usd || 0)
    map.set(key, current)
  }

  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}
