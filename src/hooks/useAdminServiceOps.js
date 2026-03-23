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
    return '302 服务暂时不可用，已跳过该区块的数据加载。其他后台功能仍可正常使用。'
  }
  return message
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
  let load302AllPromise = null
  let loadBalancePromise = null
  let loadApiLogsPromise = null
  let loadApiKeysPromise = null

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

  const load302Balance = async ({ silent = false, force = false } = {}) => {
    if (!canReadUsage.value) return
    if (loadBalancePromise && !force) return loadBalancePromise
    loadingBalance.value = true
    loadBalancePromise = (async () => {
      try {
        const rsp = await getAdmin302Balance()
        balance.value = String(rsp?.data?.balance ?? '')
        return { ok: true }
      } catch (error) {
        balance.value = ''
        const message = toServiceNotice('加载 Eager 服务余额失败', error)
        if (!silent && !error?.__handled) window.$message?.error(message)
        return { ok: false, message, error }
      } finally {
        loadingBalance.value = false
      }
    })()
    try {
      return await loadBalancePromise
    } finally {
      loadBalancePromise = null
    }
  }

  const queryRecord = async () => {
    if (!canReadUsage.value) return
    const id = String(recordRequestId.value || '').trim()
    if (!id) return window.$message?.warning('请输入 request-id')
    loadingRecord.value = true
    try {
      const rsp = await getAdmin302Record(id)
      recordData.value = rsp?.data || null
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '查询扣费记录失败'))
    } finally {
      loadingRecord.value = false
    }
  }

  const loadApiLogs = async ({ silent = false, force = false } = {}) => {
    if (!canReadUsage.value) return
    if (loadApiLogsPromise && !force) return loadApiLogsPromise
    loadingApiLogs.value = true
    loadApiLogsPromise = (async () => {
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
        const message = toServiceNotice('加载 API 日志失败', error)
        if (!silent && !error?.__handled) window.$message?.error(message)
        return { ok: false, message, error }
      } finally {
        loadingApiLogs.value = false
      }
    })()
    try {
      return await loadApiLogsPromise
    } finally {
      loadApiLogsPromise = null
    }
  }

  const loadApiKeys = async ({ silent = false, force = false } = {}) => {
    if (!canManageApiKeys.value && !canAssignApiKeys.value) return
    if (loadApiKeysPromise && !force) return loadApiKeysPromise
    loadingKeys.value = true
    loadApiKeysPromise = (async () => {
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
        const message = toServiceNotice('加载 API 密钥失败', error)
        if (!silent && !error?.__handled) window.$message?.error(message)
        return { ok: false, message, error }
      } finally {
        loadingKeys.value = false
      }
    })()
    try {
      return await loadApiKeysPromise
    } finally {
      loadApiKeysPromise = null
    }
  }

  const createApiKey = async () => {
    if (!canManageApiKeys.value) return
    if (!String(createKeyForm.api_name || '').trim()) {
      return window.$message?.warning('必须填写 api_name')
    }
    creatingApiKey.value = true
    try {
      await createAdmin302ApiKey({ ...createKeyForm, api_name: createKeyForm.api_name.trim() })
      window.$message?.success('API 密钥创建成功')
      resetCreateKeyForm(createKeyForm)
      await loadApiKeys({ force: true })
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '创建 API 密钥失败'))
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
      window.$message?.success('API 密钥更新成功')
      await loadApiKeys({ force: true })
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '更新 API 密钥失败'))
    } finally {
      updatingKeys.value = { ...updatingKeys.value, [name]: false }
    }
  }

  const removeApiKey = async (item) => {
    if (!canManageApiKeys.value) return
    const name = item.api_name
    const ok = window.confirm(`确认删除 API 密钥 ${name} 吗？`)
    if (!ok) return
    deletingKeys.value = { ...deletingKeys.value, [name]: true }
    try {
      await deleteAdmin302ApiKey(name)
      window.$message?.success('API 密钥删除成功')
      await Promise.all([loadApiKeys({ force: true }), loadUsers({ force: true }), loadLogs({ force: true })])
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '删除 API 密钥失败'))
    } finally {
      deletingKeys.value = { ...deletingKeys.value, [name]: false }
    }
  }

  const load302All = async ({ force = false } = {}) => {
    if (load302AllPromise && !force) return load302AllPromise
    serviceLoadNotice.value = ''
    load302AllPromise = (async () => {
      const tasks = []
      if (canReadUsage.value) {
        tasks.push(load302Balance({ silent: true, force }), loadApiLogs({ silent: true, force }))
      }
      if (canManageApiKeys.value || canAssignApiKeys.value) {
        tasks.push(loadApiKeys({ silent: true, force }))
      }
      const results = await Promise.all(tasks)
      const failures = results.filter((item) => item && item.ok === false)
      if (failures.length > 0) {
        serviceLoadNotice.value = failures[0].message || '服务数据加载失败'
      }
    })()
    try {
      return await load302AllPromise
    } finally {
      load302AllPromise = null
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
