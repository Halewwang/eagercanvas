import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

export const getUsageSummary = async (userId, from, to) => {
  const query = supabase
    .from('usage_events')
    .select('input_tokens,output_tokens,image_count,video_seconds,cost_usd')
    .eq('user_id', userId)

  if (from) query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to) query.lte('created_at', `${to}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, 'USAGE_SUMMARY_FAILED')

  const summary = data.reduce(
    (acc, item) => {
      acc.totalCalls += 1
      acc.totalInputTokens += item.input_tokens || 0
      acc.totalOutputTokens += item.output_tokens || 0
      acc.totalImages += item.image_count || 0
      acc.totalVideoSeconds += item.video_seconds || 0
      acc.totalCostUsd += Number(item.cost_usd || 0)
      return acc
    },
    {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalImages: 0,
      totalVideoSeconds: 0,
      totalCostUsd: 0
    }
  )

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
