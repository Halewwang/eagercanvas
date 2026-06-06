import { supabase } from '../config/supabase.js'

const toIso = (date) => date.toISOString()

export const buildIssueRetentionCutoffs = ({
  now = new Date(),
  eventRetentionDays = 30,
  notificationRetentionDays = 180
} = {}) => {
  const base = now instanceof Date ? now : new Date(now)
  return {
    eventCutoff: toIso(new Date(base.getTime() - Number(eventRetentionDays) * 24 * 60 * 60 * 1000)),
    notificationCutoff: toIso(new Date(base.getTime() - Number(notificationRetentionDays) * 24 * 60 * 60 * 1000))
  }
}

const countBefore = async (supabaseClient, table, column, cutoff) => {
  const { count, error } = await supabaseClient
    .from(table)
    .select('id', { count: 'exact', head: true })
    .lt(column, cutoff)
  if (error) return { count: 0, error }
  return { count: Number(count || 0), error: null }
}

const deleteBefore = async (supabaseClient, table, column, cutoff) => {
  const { error } = await supabaseClient
    .from(table)
    .delete()
    .lt(column, cutoff)
  return { error }
}

export const pruneIssueObservability = async ({
  supabaseClient = supabase,
  dryRun = false,
  now = new Date(),
  eventRetentionDays = 30,
  notificationRetentionDays = 180
} = {}) => {
  const cutoffs = buildIssueRetentionCutoffs({ now, eventRetentionDays, notificationRetentionDays })
  const [eventCount, notificationCount] = await Promise.all([
    countBefore(supabaseClient, 'issue_events', 'created_at', cutoffs.eventCutoff),
    countBefore(supabaseClient, 'issue_notifications', 'created_at', cutoffs.notificationCutoff)
  ])

  if (eventCount.error) return { ok: false, error: eventCount.error, dryRun, cutoffs }
  if (notificationCount.error) return { ok: false, error: notificationCount.error, dryRun, cutoffs }

  if (!dryRun) {
    const eventDelete = await deleteBefore(supabaseClient, 'issue_events', 'created_at', cutoffs.eventCutoff)
    if (eventDelete.error) return { ok: false, error: eventDelete.error, dryRun, cutoffs }
    const notificationDelete = await deleteBefore(supabaseClient, 'issue_notifications', 'created_at', cutoffs.notificationCutoff)
    if (notificationDelete.error) return { ok: false, error: notificationDelete.error, dryRun, cutoffs }
  }

  return {
    ok: true,
    dryRun,
    cutoffs,
    deleted: {
      issue_events: dryRun ? 0 : eventCount.count,
      issue_notifications: dryRun ? 0 : notificationCount.count
    },
    matched: {
      issue_events: eventCount.count,
      issue_notifications: notificationCount.count
    }
  }
}
