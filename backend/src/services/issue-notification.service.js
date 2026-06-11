import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { sendIssueAlertEmail } from './email.service.js'
import { getIssueGroupForAdmin } from './admin-issues.service.js'
import { createCodexIssueTable, exportCodexIssues, renderCodexIssueMarkdown } from './issue-codex-export.service.js'

const SEVERITY_RANK = { p0: 0, p1: 1, p2: 2, p3: 3 }

const asArray = (value) => Array.isArray(value) ? value : []
const nowIso = () => new Date().toISOString()

const parseEmails = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export const getIssueAlertRecipients = () => {
  return parseEmails(env.issueAlertEmails)
}

export const isIssueSeverityEligible = (severity, minSeverity = env.issueAlertMinSeverity || 'p1') => {
  const rank = SEVERITY_RANK[String(severity || '').toLowerCase()]
  const minRank = SEVERITY_RANK[String(minSeverity || 'p1').toLowerCase()]
  if (rank === undefined || minRank === undefined) return false
  return rank <= minRank
}

export const buildIssueAlertDecision = (group, {
  enabled = env.issueAlertEnabled,
  minSeverity = env.issueAlertMinSeverity,
  cooldownMinutes = env.issueAlertCooldownMinutes,
  maxPerHour = env.issueAlertMaxPerHour,
  recentCount = 0,
  now = nowIso
} = {}) => {
  if (!enabled) return { shouldSend: false, reason: 'disabled' }
  if (!group?.id) return { shouldSend: false, reason: 'missing_group' }
  if (!['open', 'investigating'].includes(String(group.status || 'open'))) {
    return { shouldSend: false, reason: 'status_not_notifiable' }
  }
  if (!isIssueSeverityEligible(group.severity, minSeverity)) {
    return { shouldSend: false, reason: 'below_min_severity' }
  }
  if (Number(maxPerHour || 0) > 0 && Number(recentCount || 0) >= Number(maxPerHour)) {
    return { shouldSend: false, reason: 'hourly_limit' }
  }
  if (group.last_notified_at && Number(cooldownMinutes || 0) > 0) {
    const elapsedMs = new Date(now()).getTime() - new Date(group.last_notified_at).getTime()
    if (elapsedMs < Number(cooldownMinutes) * 60 * 1000) {
      return { shouldSend: false, reason: 'cooldown' }
    }
  }
  return { shouldSend: true, reason: 'eligible' }
}

const createNotificationPayload = ({ group, recipient, status = 'queued', reason = '', nextRetryAt = null, table = null }) => ({
  issue_group_id: group.id,
  channel: 'email',
  recipient,
  status,
  reason,
  next_retry_at: nextRetryAt,
  payload: {
    schema: 'issue_alert/v1',
    issue_group_id: group.id,
    fingerprint: group.fingerprint,
    severity: group.severity,
    title: group.title,
    table
  }
})

const updateNotification = async (notificationId, payload, supabaseClient) => {
  const { data, error } = await supabaseClient
    .from('issue_notifications')
    .update({ ...payload, updated_at: nowIso() })
    .eq('id', notificationId)
    .select('*')
    .single()
  if (error) return { ok: false, data: null, error }
  return { ok: true, data, error: null }
}

const markGroupNotified = async (groupId, supabaseClient) => {
  const { data: group } = await supabaseClient
    .from('issue_groups')
    .select('notification_count')
    .eq('id', groupId)
    .maybeSingle()
  await supabaseClient
    .from('issue_groups')
    .update({
      last_notified_at: nowIso(),
      notification_count: Number(group?.notification_count || 0) + 1,
      updated_at: nowIso()
    })
    .eq('id', groupId)
}

const getRecentNotificationCount = async (supabaseClient, sinceIso) => {
  const { count, error } = await supabaseClient
    .from('issue_notifications')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
    .in('status', ['queued', 'sent'])
  if (error) return 0
  return Number(count || 0)
}

const buildEmailContent = (details) => {
  const table = createCodexIssueTable({
    details: [details],
    generatedAt: nowIso()
  })
  const issue = table.issues[0]
  const subject = `[Eager Canvas Issue ${issue.severity.toUpperCase()}] ${issue.title}`
  const text = renderCodexIssueMarkdown(table)
  const html = [
    `<h1>${issue.title}</h1>`,
    `<p><strong>Severity:</strong> ${issue.severity} | <strong>Layer:</strong> ${issue.source_layer} | <strong>Status:</strong> ${issue.status}</p>`,
    `<p><strong>Latest request:</strong> ${issue.codex_diagnosis_inputs.latest_request_id || '-'}</p>`,
    '<pre style="white-space:pre-wrap;background:#111;color:#f8f8f8;padding:16px;border-radius:8px;">',
    JSON.stringify(issue, null, 2),
    '</pre>'
  ].join('')
  return { subject, text, html, table }
}

export const sendIssueNotification = async (notification, {
  supabaseClient = supabase,
  sendEmail = sendIssueAlertEmail,
  getDetails = getIssueGroupForAdmin
} = {}) => {
  const issueGroupId = notification.issue_group_id || notification.payload?.issue_group_id
  const details = await getDetails(issueGroupId)
  const content = buildEmailContent(details)

  const result = await sendEmail({
    to: notification.recipient,
    subject: content.subject,
    html: content.html,
    text: content.text
  })

  if (result?.status === 'skipped') {
    return updateNotification(notification.id, {
      status: 'skipped',
      reason: result.reason || 'email_skipped',
      attempts: Number(notification.attempts || 0),
      error_message: result.reason || null
    }, supabaseClient)
  }

  if (result?.ok === false) {
    return updateNotification(notification.id, {
      status: 'failed',
      attempts: Number(notification.attempts || 0) + 1,
      failed_at: nowIso(),
      next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      error_message: result.error || 'email_failed'
    }, supabaseClient)
  }

  await markGroupNotified(issueGroupId, supabaseClient)
  return updateNotification(notification.id, {
    status: 'sent',
    attempts: Number(notification.attempts || 0) + 1,
    sent_at: nowIso(),
    resend_message_id: result?.id || null,
    payload: {
      ...(notification.payload || {}),
      table: content.table
    }
  }, supabaseClient)
}

export const queueIssueAlertForGroup = async (group, {
  supabaseClient = supabase,
  force = false,
  autoSend = true,
  now = nowIso,
  sendEmail = sendIssueAlertEmail,
  getDetails = getIssueGroupForAdmin,
  recipients = getIssueAlertRecipients()
} = {}) => {
  try {
    if (!force && !env.issueAlertEnabled) {
      return { ok: true, queued: [], skipped: 0, reason: 'disabled' }
    }
    const sinceIso = new Date(new Date(now()).getTime() - 60 * 60 * 1000).toISOString()
    const recentCount = await getRecentNotificationCount(supabaseClient, sinceIso)
    const decision = force
      ? { shouldSend: true, reason: 'forced' }
      : buildIssueAlertDecision(group, { recentCount, now })
    if (!decision.shouldSend) return { ok: true, queued: [], skipped: recipients.length, reason: decision.reason }
    if (!recipients.length) return { ok: true, queued: [], skipped: 0, reason: 'no_recipients' }

    const delayMs = Math.max(0, Number(env.issueAlertEvidenceDelaySeconds || 0) * 1000)
    const nextRetryAt = delayMs > 0 ? new Date(new Date(now()).getTime() + delayMs).toISOString() : null
    const rows = recipients.map((recipient) => createNotificationPayload({
      group,
      recipient,
      status: 'queued',
      reason: decision.reason,
      nextRetryAt
    }))

    const { data, error } = await supabaseClient
      .from('issue_notifications')
      .insert(rows)
      .select('*')
    if (error) return { ok: false, queued: [], skipped: 0, error }

    if (autoSend && delayMs === 0) {
      await Promise.all(asArray(data).map((notification) => sendIssueNotification(notification, {
        supabaseClient,
        sendEmail,
        getDetails
      })))
    } else if (autoSend && delayMs > 0 && delayMs <= 60_000) {
      const timer = setTimeout(() => {
        Promise.all(asArray(data).map((notification) => sendIssueNotification(notification, {
          supabaseClient,
          sendEmail,
          getDetails
        }))).catch(() => {})
      }, delayMs)
      timer.unref?.()
    }

    return { ok: true, queued: asArray(data), skipped: 0, reason: decision.reason }
  } catch (error) {
    return { ok: false, queued: [], skipped: 0, error }
  }
}

export const sendIssueAlertForGroup = async (issueGroupId, options = {}) => {
  const { group } = await getIssueGroupForAdmin(issueGroupId)
  return queueIssueAlertForGroup(group, { ...options, force: true, autoSend: true })
}

export const sendIssueDigestEmail = async ({
  to,
  filters = {},
  exportIssues = exportCodexIssues,
  sendEmail = sendIssueAlertEmail
} = {}) => {
  const recipient = String(to || '').trim()
  if (!recipient) {
    return { ok: false, status: 'skipped', reason: 'missing_recipient' }
  }

  const result = await exportIssues({
    writeFiles: false,
    filters
  })
  const issueCount = Number(result.issueCount || 0)
  const subject = `[Eager Canvas Issue Digest] ${issueCount} issues`
  const text = result.markdownContent || ''
  const html = [
    '<h1>Eager Canvas Issue Digest</h1>',
    `<p><strong>Issues:</strong> ${issueCount}</p>`,
    `<p><strong>Generated at:</strong> ${escapeHtml(result.generatedAt || '')}</p>`,
    '<pre style="white-space:pre-wrap;background:#111;color:#f8f8f8;padding:16px;border-radius:8px;">',
    escapeHtml(text),
    '</pre>'
  ].join('')
  const attachments = [
    result.jsonFileName && result.jsonContent
      ? { filename: result.jsonFileName, content: result.jsonContent }
      : null,
    result.markdownFileName && result.markdownContent
      ? { filename: result.markdownFileName, content: result.markdownContent }
      : null
  ].filter(Boolean)
  const emailResult = await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    attachments
  })

  return {
    ok: emailResult?.ok !== false,
    status: emailResult?.status || 'sent',
    id: emailResult?.id || null,
    recipient,
    issueCount,
    generatedAt: result.generatedAt,
    jsonFileName: result.jsonFileName,
    markdownFileName: result.markdownFileName,
    email: emailResult
  }
}

export const processQueuedIssueNotifications = async ({
  supabaseClient = supabase,
  limit = 20,
  sendEmail = sendIssueAlertEmail,
  getDetails = getIssueGroupForAdmin
} = {}) => {
  const { data, error } = await supabaseClient
    .from('issue_notifications')
    .select('*')
    .eq('status', 'queued')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso()}`)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(100, Number(limit) || 20)))
  if (error) return { ok: false, processed: 0, error }
  const results = await Promise.all(asArray(data).map((notification) => sendIssueNotification(notification, {
    supabaseClient,
    sendEmail,
    getDetails
  })))
  return { ok: true, processed: results.length, results }
}
