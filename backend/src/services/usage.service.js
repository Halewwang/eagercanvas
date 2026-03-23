import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

export const getUsageSummary = async (userId, from, to) => {
  const aggQuery = supabase
    .from('usage_daily_agg')
    .select('total_calls,total_images,total_video_seconds,total_cost_usd')
    .eq('user_id', userId)

  const tokenQuery = supabase
    .from('usage_events')
    .select('input_tokens,output_tokens')
    .eq('user_id', userId)

  if (from) {
    aggQuery.gte('date', String(from))
    tokenQuery.gte('created_at', `${from}T00:00:00.000Z`)
  }
  if (to) {
    aggQuery.lte('date', String(to))
    tokenQuery.lte('created_at', `${to}T23:59:59.999Z`)
  }

  const [{ data: aggData, error: aggError }, { data: tokenData, error: tokenError }] = await Promise.all([
    aggQuery,
    tokenQuery
  ])

  if (aggError) throw new HttpError(500, aggError.message, 'USAGE_SUMMARY_FAILED')
  if (tokenError) throw new HttpError(500, tokenError.message, 'USAGE_SUMMARY_FAILED')

  const summary = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalImages: 0,
    totalVideoSeconds: 0,
    totalCostUsd: 0
  }

  for (const row of aggData || []) {
    summary.totalCalls += Number(row.total_calls || 0)
    summary.totalImages += Number(row.total_images || 0)
    summary.totalVideoSeconds += Number(row.total_video_seconds || 0)
    summary.totalCostUsd += Number(row.total_cost_usd || 0)
  }

  for (const row of tokenData || []) {
    summary.totalInputTokens += Number(row.input_tokens || 0)
    summary.totalOutputTokens += Number(row.output_tokens || 0)
  }

  return summary
}

export const getUsageTimeseries = async (userId) => {
  const { data, error } = await supabase
    .from('usage_daily_agg')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) throw new HttpError(500, error.message, 'USAGE_SERIES_FAILED')
  return data
}
