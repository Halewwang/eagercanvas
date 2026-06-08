import {
  buildAdminServiceCredentialDraft,
  createAdminServiceCredentialForm,
  resetAdminServiceCredentialForm
} from './adminServiceCredentialCore.js'

export const ADMIN_LOG_302_QUERY_KEYS = ['apiName', 'start', 'end', 'page', 'limit']

export const createAdminServiceKeyForm = createAdminServiceCredentialForm

export const buildAdminServiceKeyDraft = buildAdminServiceCredentialDraft

const padDateTimeUnit = (value) => String(value).padStart(2, '0')

export const formatAdminServiceLocalDateTime = (date = new Date()) => {
  const safeDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(safeDate.getTime())) return ''
  const year = safeDate.getFullYear()
  const month = padDateTimeUnit(safeDate.getMonth() + 1)
  const day = padDateTimeUnit(safeDate.getDate())
  const hours = padDateTimeUnit(safeDate.getHours())
  const minutes = padDateTimeUnit(safeDate.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export const createAdminServiceLogQuery = ({ now = new Date(), pageSize = 10 } = {}) => {
  const safeNow = now instanceof Date ? now : new Date(now)
  const current = Number.isNaN(safeNow.getTime()) ? new Date() : safeNow
  const dayStart = new Date(current)
  dayStart.setHours(0, 0, 0, 0)
  return {
    apiName: '',
    page: 1,
    limit: pageSize,
    start: formatAdminServiceLocalDateTime(dayStart),
    end: formatAdminServiceLocalDateTime(current)
  }
}

export const toAdminServiceUnixSeconds = (value) => {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined
}

export const isAdminServiceAvailabilityError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0)
  return [500, 502, 503, 504].includes(status)
}

export const getAdminServiceNoticeMessage = (fallback, error, getErrorMessage) => {
  const message = getErrorMessage(error, fallback)
  if (isAdminServiceAvailabilityError(error)) {
    return 'Eager 服务暂时不可用，已跳过该区块的数据加载。其他后台功能仍可正常使用。'
  }
  return message
}

export const prefixAdminServiceNotice = (scope, message) => {
  const safeScope = String(scope || '').trim()
  const safeMessage = String(message || '').trim()
  if (!safeScope || !safeMessage) return safeMessage
  return `${safeScope}：${safeMessage}`
}

export const resetAdminServiceKeyForm = resetAdminServiceCredentialForm

export const updateAdminLog302Query = (query, key, value) => {
  const safeKey = String(key || '')
  if (!ADMIN_LOG_302_QUERY_KEYS.includes(safeKey)) return false
  query[safeKey] = value
  return true
}
