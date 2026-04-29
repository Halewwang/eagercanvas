import { computed, reactive, ref } from 'vue'
import {
  createAdmin302ApiKey,
  deleteAdmin302ApiKey,
  getAdmin302ApiKeys,
  getAdmin302ApiRecord,
  getAdmin302Balance,
  getAdmin302Record,
  updateAdmin302ApiKey
} from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { notifier } from '@/utils/notifier'

const createEmptyKeyForm = () => ({
  api_name: '',
  allow_save_logs: false,
  allow_custom_model: false,
  allow_manage_key: false,
  limit_cost: 0,
  limit_daily_cost: 0,
  expired_on: 0
})

const buildDraft = (item) => ({
  api_name: item.api_name,
  allow_save_logs: !!item.allow_save_logs,
  allow_custom_model: !!item.allow_custom_model,
  allow_manage_key: !!item.allow_manage_key,
  limit_cost: Number(item.limit_cost || 0),
  limit_daily_cost: Number(item.limit_daily_cost || 0),
  expired_on: Number(item.expired_on || 0)
})

const toUnixSeconds = (value) => {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined
}

const is502ServiceError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0)
  return [500, 502, 503, 504].includes(status)
}

const toServiceNotice = (fallback, error) => {
  const message = getErrorMessage(error, fallback)
  if (is502ServiceError(error)) {
    return 'Eager 服务暂时不可用，已跳过该区块的数据加载。其他后台功能仍可正常使用。'
  }
  return message
}

const prefixNotice = (scope, message) => {
  const safeScope = String(scope || '').trim()
  const safeMessage = String(message || '').trim()
  if (!safeScope || !safeMessage) return safeMessage
  return `${safeScope}：${safeMessage}`
}

const resetCreateKeyForm = (form) => {
  Object.assign(form, createEmptyKeyForm())
}

export const useAdminServiceOps = ({
  canReadUsage,
  canManageApiKeys,
  canAssignApiKeys,
  loadUsers,
  loadLogs
}) => {
  const balance = ref('')
  const loadingBalance = ref(false)
  const recordRequestId = ref('')
  const recordData = ref(null)
  const loadingRecord = ref(false)
  const log302Query = reactive({ page: 1, limit: 20, start: '', end: '' })
  const apiLogs = ref([])
  const loadingApiLogs = ref(false)
  const serviceLoadNotice = ref('')
  const apiKeys = ref([])
  const keyDrafts = ref({})
  const loadingKeys = ref(false)
  const creatingApiKey = ref(false)
  const updatingKeys = ref({})
  const deletingKeys = ref({})
  const createKeyForm = reactive(createEmptyKeyForm())

  const loading302 = computed(
    () => loadingBalance.value || loadingRecord.value || loadingApiLogs.value || loadingKeys.value
  )
  const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))
  const apiKeyOptions = computed(() => apiKeys.value.map((item) => item.api_name).filter(Boolean))

  const maskApiKey = (value) => {
    const key = String(value || '')
    if (key.length <= 10) return key || '-'
    return `${key.slice(0, 6)}...${key.slice(-4)}`
  }

  const load302Balance = async ({ silent = false } = {}) => {
    if (!canReadUsage.value) return
    loadingBalance.value = true
    try {
      const rsp = await getAdmin302Balance()
      balance.value = String(rsp?.data?.balance ?? '')
      return { ok: true }
    } catch (error) {
      balance.value = ''
      const message = toServiceNotice('加载 Eager 服务余额失败', error)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixNotice('账户余额', message), error }
    } finally {
      loadingBalance.value = false
    }
  }

  const queryRecord = async () => {
    if (!canReadUsage.value) return
    const id = String(recordRequestId.value || '').trim()
    if (!id) return notifier.warning('请输入请求 ID')
    loadingRecord.value = true
    try {
      const rsp = await getAdmin302Record(id)
      recordData.value = rsp?.data || null
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '查询消耗记录失败'))
    } finally {
      loadingRecord.value = false
    }
  }

  const loadApiLogs = async ({ silent = false } = {}) => {
    if (!canReadUsage.value) return
    loadingApiLogs.value = true
    try {
      const rsp = await getAdmin302ApiRecord({
        page: log302Query.page,
        limit: log302Query.limit,
        start_time: toUnixSeconds(log302Query.start),
        end_time: toUnixSeconds(log302Query.end)
      })
      apiLogs.value = Array.isArray(rsp?.data?.items) ? rsp.data.items : []
      return { ok: true }
    } catch (error) {
      apiLogs.value = []
      const message = toServiceNotice('加载服务调用日志失败', error)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixNotice('服务调用日志', message), error }
    } finally {
      loadingApiLogs.value = false
    }
  }

  const loadApiKeys = async ({ silent = false } = {}) => {
    if (!canManageApiKeys.value && !canAssignApiKeys.value) return
    loadingKeys.value = true
    try {
      const rsp = await getAdmin302ApiKeys()
      const list = Array.isArray(rsp?.data) ? rsp.data : []
      apiKeys.value = list
      const drafts = {}
      for (const item of list) drafts[item.api_name] = buildDraft(item)
      keyDrafts.value = drafts
      return { ok: true }
    } catch (error) {
      apiKeys.value = []
      keyDrafts.value = {}
      const message = toServiceNotice('加载服务凭证失败', error)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixNotice('服务凭证', message), error }
    } finally {
      loadingKeys.value = false
    }
  }

  const createApiKey = async () => {
    if (!canManageApiKeys.value) return
    if (!String(createKeyForm.api_name || '').trim()) {
      return notifier.warning('必须填写 api_name')
    }
    creatingApiKey.value = true
    try {
      await createAdmin302ApiKey({ ...createKeyForm, api_name: createKeyForm.api_name.trim() })
      notifier.success('服务凭证创建成功')
      resetCreateKeyForm(createKeyForm)
      await loadApiKeys()
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '创建服务凭证失败'))
    } finally {
      creatingApiKey.value = false
    }
  }

  const updateApiKey = async (item) => {
    if (!canManageApiKeys.value) return
    const name = item.api_name
    const draft = keyDrafts.value[name]
    if (!draft) return
    updatingKeys.value = { ...updatingKeys.value, [name]: true }
    try {
      await updateAdmin302ApiKey(name, { ...draft, api_name: name })
      notifier.success('服务凭证更新成功')
      await loadApiKeys()
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '更新服务凭证失败'))
    } finally {
      updatingKeys.value = { ...updatingKeys.value, [name]: false }
    }
  }

  const removeApiKey = async (item) => {
    if (!canManageApiKeys.value) return
    const name = item.api_name
    const ok = window.confirm(`确认删除服务凭证 ${name} 吗？`)
    if (!ok) return
    deletingKeys.value = { ...deletingKeys.value, [name]: true }
    try {
      await deleteAdmin302ApiKey(name)
      notifier.success('服务凭证删除成功')
      await Promise.all([loadApiKeys(), loadUsers(), loadLogs()])
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '删除服务凭证失败'))
    } finally {
      deletingKeys.value = { ...deletingKeys.value, [name]: false }
    }
  }

  const load302All = async () => {
    serviceLoadNotice.value = ''
    const tasks = []
    if (canReadUsage.value) {
      tasks.push(load302Balance({ silent: true }), loadApiLogs({ silent: true }))
    }
    if (canManageApiKeys.value || canAssignApiKeys.value) {
      tasks.push(loadApiKeys({ silent: true }))
    }
    const results = await Promise.all(tasks)
    const failures = results.filter((item) => item && item.ok === false)
    if (failures.length > 0) {
      serviceLoadNotice.value = failures[0].message || '服务数据加载失败'
    }
  }

  return {
    apiKeyOptions,
    apiKeys,
    apiLogs,
    balanceDisplay,
    createApiKey,
    createKeyForm,
    creatingApiKey,
    deletingKeys,
    keyDrafts,
    load302All,
    loadApiLogs,
    loading302,
    loadingApiLogs,
    loadingKeys,
    loadingRecord,
    maskApiKey,
    queryRecord,
    recordData,
    recordRequestId,
    removeApiKey,
    serviceLoadNotice,
    updateApiKey,
    updatingKeys,
    log302Query
  }
}

export default useAdminServiceOps
